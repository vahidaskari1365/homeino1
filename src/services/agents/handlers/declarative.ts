// ============================================================
// HOMEINO — DECLARATIVE AGENT HANDLER
//
// Runs agents that an admin created in the panel (no custom code). The agent is
// described by: system prompt + granted tools + permissions + output hints.
//
// Loop (bounded):
//   1. the LLM sees the task and the tool list, returns JSON tool calls
//   2. each call goes through the SAME permission/approval gate as built-in agents
//   3. results are fed back, then a final structured answer is produced
//   4. without a configured LLM the agent runs its `defaultToolPlan` (or answers
//      honestly that it needs a model) — it never invents a result
// ============================================================
import type { AgentHandler, HandlerContext } from "./types";
import { str } from "./types";
import { getTool } from "../tools";

interface LlmToolCall {
  tool: string;
  input?: Record<string, unknown>;
}

interface LlmDecision {
  thought?: string;
  toolCalls?: LlmToolCall[];
  answer?: Record<string, unknown>;
  done?: boolean;
}

const MAX_LOOP = 4;

export const runDeclarativeAgent: AgentHandler = async (input, ctx) => {
  const task = str(input.task) ?? str(input.prompt) ?? JSON.stringify(input).slice(0, 1200);
  /** The agent only ever sees the tools it was granted. */
  const toolDocs = ctx.grantedTools
    .map((key) => getTool(key))
    .filter((tool) => tool && ctx.permissions.includes(tool.requiredPermission))
    .map((tool) => ({
      tool: tool!.key,
      description: tool!.description,
      input: tool!.inputSchema,
      requiresApproval: Boolean(tool!.requiresApproval),
    }));

  // ---- no LLM configured: run the declarative tool plan (if any) ----
  const plan = Array.isArray(ctx.agent.config?.defaultToolPlan) ? (ctx.agent.config.defaultToolPlan as { tool: string; input?: Record<string, unknown> }[]) : [];
  const llmAvailable = await hasUsableLlm(ctx);

  if (!llmAvailable) {
    if (!plan.length) {
      ctx.log("مدل زبانی پیکربندی نشده و این ایجنت برنامه‌ی ابزار پیش‌فرض ندارد");
      return {
        output: {
          dataState: "not_enough_data",
          reason: "llm_not_configured",
          task,
          hint: "برای اجرای این ایجنت یک مدل (LLM_API_* / OLLAMA_BASE_URL / DIFY_API_KEY / LANGFLOW_*) پیکربندی کنید یا defaultToolPlan را در تنظیمات ایجنت بنویسید.",
        },
        dataState: "not_enough_data",
      };
    }
    const results: Record<string, unknown> = {};
    for (const step of plan.slice(0, MAX_LOOP)) {
      const res = await ctx.callTool(step.tool, { ...(step.input ?? {}), ...input });
      results[step.tool] = res.ok ? res.data : { error: res.error, code: res.code };
    }
    return { output: { dataState: "ok", task, mode: "tool_plan", results }, dataState: "ok" };
  }

  // ---- LLM loop ----
  const history: { role: string; content: string }[] = [];
  let answer: Record<string, unknown> | null = null;
  const toolsUsed: string[] = [];
  let dataState: "ok" | "no_data" | "not_enough_data" | "degraded" = "not_enough_data";

  for (let iteration = 0; iteration < MAX_LOOP; iteration++) {
    const decision = await askLlm(ctx, task, toolDocs, history, resultsSummary(toolsUsed, history));
    if (!decision) break;

    if (decision.answer && Object.keys(decision.answer).length) {
      answer = decision.answer;
      dataState = "ok";
      break;
    }

    const calls = (decision.toolCalls ?? []).slice(0, 3);
    if (!calls.length) {
      dataState = "not_enough_data";
      break;
    }

    for (const call of calls) {
      const toolKey = str(call.tool) ?? "";
      if (!ctx.grantedTools.includes(toolKey)) {
        history.push({ role: "tool", content: JSON.stringify({ tool: toolKey, error: "tool_not_granted" }) });
        continue;
      }
      const result = await ctx.callTool(toolKey, { ...(call.input ?? {}), userId: ctx.userId, sessionId: ctx.sessionId });
      toolsUsed.push(toolKey);
      history.push({
        role: "tool",
        content: JSON.stringify({ tool: toolKey, ok: result.ok, data: truncate(result.data), error: result.error ?? null }).slice(0, 4000),
      });
      if (!result.ok) dataState = "degraded";
    }
  }

  if (!answer) {
    // One last attempt to summarise what the tools actually returned.
    const finalDecision = await askLlm(ctx, task, toolDocs, history, resultsSummary(toolsUsed, history), true);
    answer = finalDecision?.answer ?? null;
    dataState = answer ? "ok" : toolsUsed.length ? "degraded" : "not_enough_data";
  }

  return {
    output: {
      dataState,
      task,
      mode: "llm_loop",
      toolsUsed,
      iterations: history.filter((h) => h.role === "tool").length,
      answer: answer ?? null,
      honestNote: dataState === "ok" ? undefined : "پاسخ کامل از داده‌ی واقعی به دست نیامد.",
    },
    dataState,
  };
};

async function hasUsableLlm(ctx: HandlerContext): Promise<boolean> {
  if (!ctx.permissions.includes("CALL_LLM")) return false;
  const { llmStatus } = await import("../llmGateway");
  return llmStatus().some((entry) => entry.configured && entry.provider !== "heuristic");
}

async function askLlm(
  ctx: HandlerContext,
  task: string,
  toolDocs: { tool: string; description: string; input: Record<string, string>; requiresApproval: boolean }[],
  history: { role: string; content: string }[],
  results: string,
  final = false,
): Promise<LlmDecision | null> {
  const system = [
    ctx.agent.systemPrompt?.trim() || `تو ایجنت «${ctx.agent.name}» در مارکت‌پلیس دکوراسیون Homeino هستی.`,
    "قانون‌ها: فقط از ابزارهای فهرست‌شده استفاده کن. هیچ productId، SKU، قیمت، فروشگاه یا URL نساز. اگر داده‌ی واقعی کافی نیست، done=true و answer با dataState='not_enough_data' برگردان. خروجی فقط JSON معتبر است.",
    final ? "حالا فقط بر اساس نتایج ابزارها پاسخ نهایی را در answer بنویس (بدون فراخوانی ابزار جدید)." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = JSON.stringify({
    task: task.slice(0, 1500),
    availableTools: toolDocs,
    context: { userId: ctx.userId, sessionId: ctx.sessionId, agent: ctx.agent.key },
    toolResults: results,
    expectedOutput: final ? { answer: { dataState: "ok|no_data|not_enough_data", summary: "string", items: "array?" } } : { thought: "string?", toolCalls: [{ tool: "string", input: {} }], answer: "object?", done: "boolean?" },
  }).slice(0, 6000);

  const result = await ctx.callTool("llmComplete", { system, prompt, json: true, maxTokens: 500 });
  if (!result.ok) return null;
  const payload = ((result.data as { data?: unknown })?.data ?? result.data) as LlmDecision | null;
  if (!payload || typeof payload !== "object") return null;
  void history;
  return payload;
}

function resultsSummary(toolsUsed: string[], history: { role: string; content: string }[]): string {
  const toolMessages = history.filter((h) => h.role === "tool").map((h) => h.content);
  return JSON.stringify({ toolsUsed, lastResults: toolMessages.slice(-3) }).slice(0, 3000);
}

function truncate(value: unknown, max = 1500): unknown {
  try {
    const json = JSON.stringify(value ?? null);
    if (json.length <= max) return value;
    return { truncated: true, preview: json.slice(0, max) };
  } catch {
    return null;
  }
}

/** Small helper used by tests to keep the loop bound explicit. */
export const DECLARATIVE_MAX_LOOP = MAX_LOOP;
