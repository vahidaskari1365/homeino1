// ============================================================
// HOMEINO — LOCAL AGENT RUNTIME (the core orchestrator loop)
//
//   resolve agent → check budget → build gated tool context → run handler
//   (bounded retries + backoff + timeout) → guard output → persist execution log
//
// Guarantees:
//   • an agent only sees the tools it was granted AND has permission for
//   • tools flagged `requiresApproval` pause the run instead of executing
//   • output is validated against the real catalog before it is returned
//   • failures never produce fake products/prices/orders — they produce an
//     honest error and a log row
// ============================================================
import type {
  AgentDefinition,
  AgentErrorCode,
  AgentRunRequest,
  AgentRunResult,
  AgentRuntime,
  RunStatus,
  TokenUsage,
  ToolCallContext,
} from "./types";
import { ensureSeeded, getStore } from "./store";
import { executeTool, getTool, publicProduct } from "./tools";
import { resolveHandler, type HandlerContext, type HandlerResult } from "./handlers";
import { guardAgentOutput, summarizeProductLists } from "./outputGuard";
import { checkRunBudget } from "../automation/costControl";
import { requestApproval } from "../automation/approvals";
import { riskOf } from "./permissions";
import { resolveAgentRuntime } from "./integrations/externalRuntimes";
import type { CatalogProduct } from "./catalog";

/** In-process cancellation flags (a run may also be cancelled via its DB row). */
const cancelledRuns = new Set<string>();

const MAX_LOG_LINES = 60;
const BACKOFF_BASE_MS = 150;
const BACKOFF_MAX_MS = 2000;

function emptyUsage(): TokenUsage {
  return { provider: "none", model: "none", tokensIn: 0, tokensOut: 0, costMicro: 0, durationMs: 0 };
}

function failed(agentKey: string, error: string, code: AgentErrorCode, usage: TokenUsage, attempts: number): AgentRunResult {
  return { ok: false, status: "failed", agentKey, output: {}, toolsUsed: [], usage, attempts, error, errorCode: code, dataState: "no_data" };
}

export async function runAgent(agent: AgentDefinition, req: AgentRunRequest): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const usage = emptyUsage();
  const logs: { at: string; message: string; meta?: Record<string, unknown> }[] = [];
  const toolsUsed: string[] = [];
  const log = (message: string, meta?: Record<string, unknown>) => {
    logs.push({ at: new Date().toISOString(), message, meta });
    if (logs.length > MAX_LOG_LINES) logs.shift();
  };

  // ---- delegation to an external runtime (Dify / Langflow) ----
  if (agent.runtime !== "local") {
    const runtime = resolveAgentRuntime(agent, localAgentRuntime);
    if (runtime.name !== "local") {
      log(`اجرا به پروایدر بیرونی ${runtime.name} سپرده شد`);
      const result = await runtime.run({ ...req, agent } as AgentRunRequest);
      await persistRun(agent, req, result, startedAt, logs);
      return result;
    }
    log(`پروایدر ${agent.runtime} پیکربندی نشده — اجرا به‌صورت محلی ادامه می‌یابد`);
  }

  // ---- activation gate ----
  if (agent.status !== "active") {
    const result = failed(agent.key, `ایجنت در وضعیت ${agent.status} است و اجرا نمی‌شود`, "AGENT_INACTIVE", usage, 0);
    await persistRun(agent, req, result, startedAt, logs);
    return result;
  }

  // ---- budget gate ----
  const budget = await checkRunBudget({ agentKey: agent.key, workflowKey: str(req.input?.workflowKey), userId: req.userId ?? null });
  if (!budget.allowed) {
    log(`اجرا به دلیل محدودیت هزینه متوقف شد: ${budget.reason}`);
    const result = failed(agent.key, budget.reason ?? "budget exceeded", "BUDGET_EXCEEDED", usage, 0);
    await persistRun(agent, req, result, startedAt, logs);
    return result;
  }

  const store = await getStore();
  let pendingApproval: { id: string; action: string; risk: string } | null = null;

  // ---- gated tool context ----
  const toolContext: ToolCallContext = {
    agentKey: agent.key,
    permissions: agent.permissions,
    grantedTools: agent.tools,
    userId: req.userId ?? null,
    sessionId: req.sessionId ?? null,
    runId: req.runId ?? null,
    actorRole: "system",
    depth: 0,
    log,
    addUsage: (partial) => {
      if (partial.provider) usage.provider = partial.provider;
      if (partial.model) usage.model = partial.model;
      usage.tokensIn += partial.tokensIn ?? 0;
      usage.tokensOut += partial.tokensOut ?? 0;
      usage.costMicro += partial.costMicro ?? 0;
    },
    callTool: async (key, input) => {
      const call = await executeTool(key, input ?? {}, toolContext);
      if (call.ok) toolsUsed.push(key);
      return call.data;
    },
  };

  const handlerContext: HandlerContext = {
    agent,
    userId: req.userId ?? null,
    sessionId: req.sessionId ?? null,
    runId: req.runId ?? null,
    taskId: req.taskId ?? null,
    actorRole: "system",
    permissions: agent.permissions,
    grantedTools: agent.tools,
    context: req.context ?? {},
    log,
    addUsage: toolContext.addUsage,
    async requestApproval(action, reason, payload) {
      const approvalId = await requestApproval({
        agentKey: agent.key,
        action,
        reason,
        riskLevel: "high",
        payload: payload ?? {},
        taskId: req.taskId ?? null,
        runId: req.runId ?? null,
      });
      pendingApproval = { id: approvalId, action, risk: "high" };
      return approvalId;
    },
    async callTool(key, input) {
      const tool = getTool(key);
      if (!tool) {
        log(`ابزار ناشناخته: ${key}`);
        return { ok: false, error: `tool not found: ${key}`, code: "TOOL_NOT_FOUND" };
      }
      if (!agent.tools.includes(key)) {
        log(`ابزار ${key} به ایجنت اعطا نشده است`);
        return { ok: false, error: `tool not granted: ${key}`, code: "TOOL_NOT_GRANTED" };
      }
      if (!agent.permissions.includes(tool.requiredPermission)) {
        log(`مجوز ${tool.requiredPermission} برای ابزار ${key} وجود ندارد`);
        return { ok: false, error: `permission denied: ${tool.requiredPermission}`, code: "PERMISSION_DENIED" };
      }
      if (tool.requiresApproval) {
        const approvalId = await requestApproval({
          agentKey: agent.key,
          action: `tool:${tool.key}`,
          reason: `ابزار ${tool.name} نیاز به تأیید انسانی دارد`,
          riskLevel: riskOf(tool.requiredPermission),
          payload: { ...(input ?? {}), tool: tool.key },
          taskId: req.taskId ?? null,
          runId: req.runId ?? null,
        });
        pendingApproval = { id: approvalId, action: `tool:${tool.key}`, risk: riskOf(tool.requiredPermission) };
        log(`درخواست تأیید انسانی برای ${tool.key} ثبت شد`, { approvalId });
        return { ok: false, error: "human approval required", code: "APPROVAL_REQUIRED", approvalRequired: true, approvalId };
      }
      const result = await executeTool(key, input ?? {}, toolContext);
      if (result.ok) toolsUsed.push(key);
      return result;
    },
  };

  // ---- execute with bounded retry + timeout ----
  const handler = resolveHandler(agent.handler);
  const maxAttempts = Math.max(1, agent.maxRetries + 1);
  let attempt = 0;
  let handlerResult: HandlerResult | null = null;
  let lastError: { message: string; code: AgentErrorCode } | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    if (cancelledRuns.has(agentRunKey(req))) {
      const result: AgentRunResult = { ok: false, status: "cancelled", agentKey: agent.key, output: {}, toolsUsed, usage: finishUsage(usage, startedAt), attempts: attempt, errorCode: "CANCELLED", error: "run cancelled", dataState: "no_data" };
      await persistRun(agent, req, result, startedAt, logs);
      cancelledRuns.delete(agentRunKey(req));
      return result;
    }
    try {
      handlerResult = await withTimeout(() => handler(req.input ?? {}, handlerContext), agent.timeoutMs, agent.key);
      lastError = null;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code: AgentErrorCode = message.startsWith("timeout:") ? "TIMEOUT" : "INTERNAL";
      lastError = { message, code };
      log(`تلاش ${attempt} ناموفق: ${message}`);
      if (attempt < maxAttempts) await sleep(Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 4 ** (attempt - 1)));
    }
  }

  if (pendingApproval) {
    const result: AgentRunResult = {
      ok: false,
      status: "waiting_approval",
      agentKey: agent.key,
      output: handlerResult?.output ?? {},
      toolsUsed,
      usage: finishUsage(usage, startedAt),
      attempts: attempt,
      errorCode: "APPROVAL_REQUIRED",
      error: "این اجرا منتظر تأیید انسانی است",
      approval: pendingApproval,
      dataState: handlerResult?.dataState ?? "not_enough_data",
    };
    await persistRun(agent, req, result, startedAt, logs);
    return result;
  }

  if (!handlerResult || lastError) {
    const result = failed(agent.key, lastError?.message ?? "handler produced no result", lastError?.code ?? "INTERNAL", finishUsage(usage, startedAt), attempt);
    await persistRun(agent, req, result, startedAt, [...logs]);
    return result;
  }

  // ---- output guard: no fabricated products / prices / urls ----
  const guarded = await guardAgentOutput(handlerResult.output ?? {});
  const lists = summarizeProductLists(guarded.output);
  if (guarded.report.removals.length) {
    log(`${guarded.report.removals.length} مقدار نامعتبر از خروجی حذف/اصلاح شد`, { removals: guarded.report.removals.slice(0, 5) });
  }

  const dataState: AgentRunResult["dataState"] =
    handlerResult.dataState ?? (lists.empty.length ? "no_data" : guarded.report.removals.length ? "degraded" : "ok");

  const result: AgentRunResult = {
    ok: true,
    status: "completed",
    agentKey: agent.key,
    output: {
      ...guarded.output,
      dataState,
      _agent: {
        key: agent.key,
        handler: agent.handler ?? "declarative",
        attempts: attempt,
        logs,
        guard: guarded.report.removals.length || guarded.report.warnings.length ? guarded.report : undefined,
        store: store.mode,
      },
    },
    toolsUsed: [...new Set(toolsUsed)],
    usage: finishUsage(usage, startedAt),
    attempts: attempt,
    dataState,
  };

  await persistRun(agent, req, result, startedAt, logs);
  return result;
}

async function persistRun(
  agent: AgentDefinition,
  req: AgentRunRequest,
  result: AgentRunResult,
  startedAt: number,
  logs: { at: string; message: string; meta?: Record<string, unknown> }[],
) {
  try {
    const store = await getStore();
    const agentRunId = await store.logAgentRun({
      agentKey: agent.key,
      agentId: agent.id ?? null,
      runId: req.runId ?? null,
      taskId: req.taskId ?? null,
      userId: req.userId ?? null,
      status: result.status as RunStatus,
      input: redactInput(req.input ?? {}),
      output: { ...(result.output ?? {}), _logs: logs.slice(-20) },
      toolsUsed: result.toolsUsed,
      provider: result.usage.provider,
      model: result.usage.model,
      tokensIn: result.usage.tokensIn,
      tokensOut: result.usage.tokensOut,
      costMicro: result.usage.costMicro,
      durationMs: result.usage.durationMs || Date.now() - startedAt,
      attempt: result.attempts,
      error: result.error ?? null,
      errorCode: result.errorCode ?? null,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
    });
    result.agentRunId = agentRunId;
    if (req.taskId) {
      await store.addTaskLog(req.taskId, result.ok ? "info" : "warn", `اجرای ایجنت ${agent.key}: ${result.status}`, {
        agentRunId,
        toolsUsed: result.toolsUsed,
        costMicro: result.usage.costMicro,
        error: result.error ?? null,
      });
    }
  } catch (error) {
    // Logging must never break a run.
    console.warn("[agents] execution log write failed:", (error as Error).message);
  }
}

/** Strip anything that looks like a secret or a huge blob from stored input. */
function redactInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/key|token|secret|password|authorization/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > 2000) {
      out[key] = `${value.slice(0, 2000)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function finishUsage(usage: TokenUsage, startedAt: number): TokenUsage {
  return { ...usage, durationMs: Date.now() - startedAt };
}

function agentRunKey(req: AgentRunRequest): string {
  return req.runId ?? `${req.agentKey}:${req.userId ?? ""}:${req.sessionId ?? ""}`;
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return fn();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout: ${label} exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);

// ------------------------------------------------------------
// Public runtime + helpers
// ------------------------------------------------------------
export const localAgentRuntime: AgentRuntime = {
  name: "local",
  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const agent = await getAgentDefinitionForRun(req.agentKey);
    if (!agent) return failed(req.agentKey, `ایجنت پیدا نشد: ${req.agentKey}`, "AGENT_NOT_FOUND", emptyUsage(), 0);
    return runAgent(agent, req);
  },
  async cancel(runKey: string) {
    cancelledRuns.add(runKey);
  },
  async getStatus(agentRunId: string) {
    const store = await getStore();
    const logs = await store.listAgentRuns({ limit: 200 });
    return (logs.find((log) => log.id === agentRunId)?.status as RunStatus) ?? null;
  },
};

async function getAgentDefinitionForRun(key: string): Promise<AgentDefinition | null> {
  const store = await ensureSeeded();
  return store.getAgent(key);
}

/** Convenience used by tools, workflows and API routes. */
export async function runAgentByKey(agentKey: string, req: Omit<AgentRunRequest, "agentKey"> & { input?: Record<string, unknown> }): Promise<AgentRunResult> {
  return localAgentRuntime.run({ ...req, agentKey, input: req.input ?? {} });
}

export function cancelAgentRun(runKey: string) {
  cancelledRuns.add(runKey);
}

export function isRunCancelled(runKey: string) {
  return cancelledRuns.has(runKey);
}

/** Compact product serialization reused by workflow nodes. */
export { publicProduct };
export type { CatalogProduct };
