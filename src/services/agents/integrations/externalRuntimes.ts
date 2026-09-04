// ============================================================
// HOMEINO — EXTERNAL AGENT/WORKFLOW RUNTIMES (Dify · Langflow)
//
// The orchestrator is Homeino's own, but an agent or a workflow can be delegated
// to an external platform through the same interfaces:
//
//   Dify      POST {DIFY_API_BASE_URL}/workflows/run   (Bearer app API key)
//             POST {DIFY_API_BASE_URL}/chat-messages
//             GET  {DIFY_API_BASE_URL}/workflows/run/{id}
//             POST {DIFY_API_BASE_URL}/workflows/tasks/{taskId}/stop
//
//   Langflow  POST {LANGFLOW_BASE_URL}/api/v1/run/{flowId}?stream=false (x-api-key)
//
// Keys live in the server environment only. If a platform is not configured the
// run FAILS with an honest error — it never silently pretends to have executed.
// ============================================================
import { getStore } from "../store";
import type {
  AgentDefinition,
  AgentRunRequest,
  AgentRunResult,
  AgentRuntime,
  RunStatus,
  TokenUsage,
  WorkflowDefinition,
  WorkflowRunRequest,
  WorkflowRunResult,
  WorkflowRuntime,
  WorkflowValidationIssue,
} from "../types";

const emptyUsage = (provider: string, model: string): TokenUsage => ({ provider, model, tokensIn: 0, tokensOut: 0, costMicro: 0, durationMs: 0 });

const env = {
  difyBase: () => (process.env.DIFY_API_BASE_URL ?? "https://api.dify.ai/v1").replace(/\/+$/, ""),
  difyKey: () => process.env.DIFY_API_KEY ?? "",
  langflowBase: () => (process.env.LANGFLOW_BASE_URL ?? "").replace(/\/+$/, ""),
  langflowKey: () => process.env.LANGFLOW_API_KEY ?? "",
  langflowFlow: () => process.env.LANGFLOW_FLOW_ID ?? "",
};

export const isDifyConfigured = () => Boolean(env.difyKey());
export const isLangflowConfigured = () => Boolean(env.langflowBase() && env.langflowKey());

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<{ status: number; json: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: controller.signal });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text.slice(0, 1000) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function failure(agentKey: string, error: string, code: AgentRunResult["errorCode"], startedAt: number, provider: string): AgentRunResult {
  return {
    ok: false,
    status: "failed",
    agentKey,
    output: {},
    toolsUsed: [],
    usage: { ...emptyUsage(provider, ""), durationMs: Date.now() - startedAt },
    attempts: 1,
    error,
    errorCode: code,
    dataState: "no_data",
  };
}

// ------------------------------------------------------------
// Dify
// ------------------------------------------------------------
export const difyAgentRuntime: AgentRuntime = {
  name: "dify",
  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const startedAt = Date.now();
    if (!isDifyConfigured()) return failure(req.agentKey, "Dify پیکربندی نشده است (DIFY_API_KEY)", "PROVIDER_ERROR", startedAt, "dify");
    const agent = (req as AgentRunRequest & { agent?: AgentDefinition }).agent;
    const workflowId = typeof agent?.config?.difyWorkflowId === "string" ? agent.config.difyWorkflowId : undefined;
    const headers = { Authorization: `Bearer ${env.difyKey()}` };
    const user = req.userId ? `user:${req.userId}` : `session:${req.sessionId ?? "anonymous"}`;

    try {
      if (workflowId) {
        const { status, json } = await post(`${env.difyBase()}/workflows/run`, headers, { inputs: req.input, response_mode: "blocking", user }, 45_000);
        if (status >= 400) return failure(req.agentKey, `Dify workflow error HTTP ${status}`, "PROVIDER_ERROR", startedAt, "dify");
        const data = (json.data ?? {}) as Record<string, unknown>;
        const usage = (data as { total_tokens?: number }).total_tokens ?? 0;
        return {
          ok: true,
          status: (data.status === "succeeded" ? "completed" : data.status === "failed" ? "failed" : "completed") as RunStatus,
          agentKey: req.agentKey,
          output: (data.outputs as Record<string, unknown>) ?? {},
          toolsUsed: [],
          usage: { provider: "dify", model: String(workflowId), tokensIn: 0, tokensOut: Number(usage), costMicro: Math.round(Number(usage) * 0.12), durationMs: Date.now() - startedAt },
          attempts: 1,
          dataState: "ok",
        };
      }

      const { status, json } = await post(
        `${env.difyBase()}/chat-messages`,
        headers,
        { inputs: {}, query: JSON.stringify(req.input).slice(0, 3000), response_mode: "blocking", user, conversation_id: "" },
        45_000,
      );
      if (status >= 400) return failure(req.agentKey, `Dify chat error HTTP ${status}`, "PROVIDER_ERROR", startedAt, "dify");
      const metadata = (json.metadata ?? {}) as { usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number } };
      const tokensIn = metadata.usage?.prompt_tokens ?? 0;
      const tokensOut = metadata.usage?.completion_tokens ?? 0;
      return {
        ok: true,
        status: "completed",
        agentKey: req.agentKey,
        output: { answer: json.answer ?? "", messageId: json.message_id ?? null },
        toolsUsed: [],
        usage: { provider: "dify", model: String(json.model ?? "dify-app"), tokensIn, tokensOut, costMicro: Math.round((tokensIn + tokensOut) * 0.12), durationMs: Date.now() - startedAt },
        attempts: 1,
        dataState: "ok",
      };
    } catch (error) {
      return failure(req.agentKey, error instanceof Error ? error.message : String(error), "PROVIDER_ERROR", startedAt, "dify");
    }
  },
  async cancel(taskId: string) {
    if (!isDifyConfigured()) return;
    try {
      await post(`${env.difyBase()}/workflows/tasks/${taskId}/stop`, { Authorization: `Bearer ${env.difyKey()}` }, { user: "homeino" }, 10_000);
    } catch {
      /* best effort */
    }
  },
  async getStatus(runId: string) {
    if (!isDifyConfigured()) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${env.difyBase()}/workflows/run/${runId}`, { headers: { Authorization: `Bearer ${env.difyKey()}` }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { status?: string } };
      const status = json.data?.status;
      if (status === "succeeded") return "completed";
      if (status === "failed") return "failed";
      if (status === "stopped") return "cancelled";
      if (status === "running") return "running";
      return null;
    } catch {
      return null;
    }
  },
};

// ------------------------------------------------------------
// Langflow
// ------------------------------------------------------------
export const langflowAgentRuntime: AgentRuntime = {
  name: "langflow",
  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const startedAt = Date.now();
    if (!isLangflowConfigured()) return failure(req.agentKey, "Langflow پیکربندی نشده است (LANGFLOW_BASE_URL + LANGFLOW_API_KEY)", "PROVIDER_ERROR", startedAt, "langflow");
    const agent = (req as AgentRunRequest & { agent?: AgentDefinition }).agent;
    const flowId = typeof agent?.config?.langflowFlowId === "string" ? agent.config.langflowFlowId : env.langflowFlow();
    if (!flowId) return failure(req.agentKey, "شناسه‌ی Flow برای Langflow تعیین نشده است", "PROVIDER_ERROR", startedAt, "langflow");

    try {
      const { status, json } = await post(
        `${env.langflowBase()}/api/v1/run/${flowId}?stream=false`,
        { "x-api-key": env.langflowKey() },
        { input_value: JSON.stringify(req.input).slice(0, 4000), input_type: "text", output_type: "any", tweaks: {} },
        60_000,
      );
      if (status >= 400) return failure(req.agentKey, `Langflow error HTTP ${status}`, "PROVIDER_ERROR", startedAt, "langflow");
      const outputs = (json.outputs ?? []) as { results?: { outputs?: { results?: unknown }[] }[] }[];
      const result = outputs[0]?.results?.[0]?.outputs?.[0]?.results ?? null;
      return {
        ok: true,
        status: "completed",
        agentKey: req.agentKey,
        output: { flowId, result: (result as Record<string, unknown>) ?? {} },
        toolsUsed: [],
        usage: { ...emptyUsage("langflow", flowId), durationMs: Date.now() - startedAt },
        attempts: 1,
        dataState: "ok",
      };
    } catch (error) {
      return failure(req.agentKey, error instanceof Error ? error.message : String(error), "PROVIDER_ERROR", startedAt, "langflow");
    }
  },
  async cancel() {
    /* Langflow runs are request-scoped; nothing to cancel. */
  },
  async getStatus() {
    return null;
  },
};

// ------------------------------------------------------------
// Workflow-level delegation (used by workflows/runtime.ts)
// ------------------------------------------------------------
export async function runWorkflowOnDify(workflow: WorkflowDefinition, req: WorkflowRunRequest): Promise<WorkflowRunResult | null> {
  const externalId = typeof workflow.config?.difyWorkflowId === "string" ? workflow.config.difyWorkflowId : null;
  if (!isDifyConfigured() || !externalId) return null;
  const startedAt = Date.now();
  const { status, json } = await post(
    `${env.difyBase()}/workflows/run`,
    { Authorization: `Bearer ${env.difyKey()}` },
    { inputs: { ...(req.input ?? {}), trigger: req.triggerKind, ...(req.triggerPayload ?? {}) }, response_mode: "blocking", user: req.userId ? `user:${req.userId}` : "homeino" },
    60_000,
  );
  const data = (json.data ?? {}) as Record<string, unknown>;
  return {
    ok: status < 400 && data.status !== "failed",
    status: data.status === "succeeded" ? "completed" : data.status === "failed" ? "failed" : "completed",
    runId: String(json.workflow_run_id ?? ""),
    workflowKey: workflow.key,
    output: (data.outputs as Record<string, unknown>) ?? {},
    steps: [],
    usage: { provider: "dify", model: externalId, tokensIn: 0, tokensOut: Number(data.total_tokens ?? 0), costMicro: Math.round(Number(data.total_tokens ?? 0) * 0.12), durationMs: Date.now() - startedAt },
    error: status >= 400 ? `Dify HTTP ${status}` : (data.error as string | undefined) ?? undefined,
    dataState: "ok",
  };
}

export async function runWorkflowOnLangflow(workflow: WorkflowDefinition, req: WorkflowRunRequest): Promise<WorkflowRunResult | null> {
  const flowId = typeof workflow.config?.langflowFlowId === "string" ? workflow.config.langflowFlowId : null;
  if (!isLangflowConfigured() || !flowId) return null;
  const startedAt = Date.now();
  const { status, json } = await post(
    `${env.langflowBase()}/api/v1/run/${flowId}?stream=false`,
    { "x-api-key": env.langflowKey() },
    { input_value: JSON.stringify({ ...(req.input ?? {}), trigger: req.triggerKind, ...(req.triggerPayload ?? {}) }).slice(0, 4000), input_type: "text", output_type: "any" },
    60_000,
  );
  const outputs = (json.outputs ?? []) as { results?: { outputs?: { results?: unknown }[] }[] }[];
  return {
    ok: status < 400,
    status: status < 400 ? "completed" : "failed",
    workflowKey: workflow.key,
    output: { flowId, result: outputs[0]?.results?.[0]?.outputs?.[0]?.results ?? null },
    steps: [],
    usage: { ...emptyUsage("langflow", flowId), durationMs: Date.now() - startedAt },
    error: status >= 400 ? `Langflow HTTP ${status}` : undefined,
    dataState: "ok",
  };
}

/** Resolve the runtime an agent should execute on. */
export function resolveAgentRuntime(agent: AgentDefinition, local: AgentRuntime): AgentRuntime {
  switch (agent.runtime) {
    case "dify":
      return isDifyConfigured() ? difyAgentRuntime : local;
    case "langflow":
      return isLangflowConfigured() ? langflowAgentRuntime : local;
    default:
      return local;
  }
}

// ------------------------------------------------------------
// Workflow runtimes (WorkflowRuntime contract) — used by workflows/runtime.ts
// ------------------------------------------------------------
function externalWorkflowFailure(workflowKey: string, error: string): WorkflowRunResult {
  return {
    ok: false,
    status: "failed",
    workflowKey,
    output: {},
    steps: [],
    usage: emptyUsage("external", ""),
    error,
    errorCode: "PROVIDER_ERROR",
    dataState: "no_data",
  };
}

export const difyWorkflowRuntime: WorkflowRuntime = {
  name: "dify",
  get available() {
    return isDifyConfigured();
  },
  get error() {
    return isDifyConfigured() ? null : "DIFY_API_KEY تنظیم نشده است";
  },
  async execute(req: WorkflowRunRequest): Promise<WorkflowRunResult> {
    if (!isDifyConfigured()) return externalWorkflowFailure(req.workflowKey, "Dify پیکربندی نشده است (DIFY_API_KEY)");
    const store = await getStore();
    const workflow = await store.getWorkflow(req.workflowKey);
    if (!workflow) return externalWorkflowFailure(req.workflowKey, `ورک‌فلو پیدا نشد: ${req.workflowKey}`);
    const result = await runWorkflowOnDify(workflow, req);
    return result ?? externalWorkflowFailure(req.workflowKey, "workflowId مربوط به Dify برای این ورک‌فلو تعریف نشده است");
  },
  async validate(): Promise<WorkflowValidationIssue[]> {
    return isDifyConfigured() ? [] : [{ level: "error", message: "Dify پیکربندی نشده است" }];
  },
  async schedule(): Promise<{ nextRunAt: Date | null }> {
    // Dify schedules live on the Dify side.
    return { nextRunAt: null };
  },
};

export const langflowWorkflowRuntime: WorkflowRuntime = {
  name: "langflow",
  get available() {
    return isLangflowConfigured();
  },
  get error() {
    return isLangflowConfigured() ? null : "LANGFLOW_BASE_URL / LANGFLOW_API_KEY تنظیم نشده است";
  },
  async execute(req: WorkflowRunRequest): Promise<WorkflowRunResult> {
    if (!isLangflowConfigured()) return externalWorkflowFailure(req.workflowKey, "Langflow پیکربندی نشده است");
    const store = await getStore();
    const workflow = await store.getWorkflow(req.workflowKey);
    if (!workflow) return externalWorkflowFailure(req.workflowKey, `ورک‌فلو پیدا نشد: ${req.workflowKey}`);
    const result = await runWorkflowOnLangflow(workflow, req);
    return result ?? externalWorkflowFailure(req.workflowKey, "flowId مربوط به Langflow برای این ورک‌فلو تعریف نشده است");
  },
  async validate(): Promise<WorkflowValidationIssue[]> {
    return isLangflowConfigured() ? [] : [{ level: "error", message: "Langflow پیکربندی نشده است" }];
  },
  async schedule(): Promise<{ nextRunAt: Date | null }> {
    return { nextRunAt: null };
  },
};
