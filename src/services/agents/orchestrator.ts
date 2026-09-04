// ============================================================
// HOMEINO — AGENT ORCHESTRATOR (the core lives inside Homeino)
//
// One façade over the whole agentic system:
//   • status/health of every subsystem (store, LLM, browser, integrations)
//   • intent routing: a customer message → the right agent(s)
//   • recommendations, memory, workflows, tasks, approvals, budgets
//
// External platforms (Dify / Langflow / Browser Use / Mem0 / Ollama) sit behind
// the swappable runtime interfaces — nothing in the site depends on them.
// ============================================================
import type { AgentRunResult, WorkflowRunResult } from "./types";
import { ensureSeeded, storeMode, storeModeReason } from "./store";
import { runAgentByKey, cancelAgentRun, localAgentRuntime } from "./runtime";
import { extractShoppingIntent } from "./nlu";
import { llmStatus } from "./llmGateway";
import { browserProviderStatus, resolveBrowserRuntime } from "./integrations/browserRuntime";
import { difyAgentRuntime, langflowAgentRuntime, difyWorkflowRuntime, langflowWorkflowRuntime, runWorkflowOnDify, runWorkflowOnLangflow } from "./integrations/externalRuntimes";
import { runWorkflow, localWorkflowRuntime, resolveWorkflowRuntime } from "../workflows/runtime";
import { executeWorkflowByKey, resumeWorkflowRun } from "../workflows/engine";
import { tickScheduler, scheduleStatus } from "../workflows/scheduler";
import { recordEvent, eventStats, type TrackResult, type TrackedEventInput } from "../workflows/triggers";
import { listTasks, createTask, retryTask, cancelTask, taskQueueSummary } from "../automation/taskQueue";
import { listApprovals, decideApproval, expireStaleApprovals } from "../automation/approvals";
import { listExecutionLogs, executionSummary } from "../automation/executionLog";
import { checkRunBudget, getBudgetStatus, setBudget } from "../automation/costControl";
import { listAgents, listToolRegistry, agentRegistryMeta } from "./registry";
import { listWorkflows, workflowBuilderMeta } from "../workflows/registry";
import { customerMemory } from "../memory/customerMemory";
import { effectiveProfile } from "../memory/preferenceEngine";

export interface OrchestratorStatus {
  store: { mode: "database" | "memory"; reason: string };
  llm: ReturnType<typeof llmStatus>;
  browser: ReturnType<typeof browserProviderStatus>;
  integrations: {
    difyAgent: { available: boolean; error?: string | null };
    difyWorkflow: { available: boolean; error?: string | null };
    langflowAgent: { available: boolean; error?: string | null };
    langflowWorkflow: { available: boolean; error?: string | null };
  };
  counts: { agents: number; activeAgents: number; workflows: number; activeWorkflows: number; tools: number; tasks: number; pendingApprovals: number };
  memory: ReturnType<typeof customerMemory.status>;
}

export async function orchestratorStatus(): Promise<OrchestratorStatus> {
  const store = await ensureSeeded();
  const [agents, workflows, tools, taskCounts, approvals] = await Promise.all([
    store.listAgents(),
    store.listWorkflows(),
    listToolRegistry(),
    taskQueueSummary(),
    listApprovals({ status: "pending", limit: 200 }),
  ]);

  return {
    store: { mode: storeMode(), reason: storeModeReason() },
    llm: llmStatus(),
    browser: browserProviderStatus(),
    integrations: {
      difyAgent: { available: Boolean(difyAgentRuntime.available), error: difyAgentRuntime.error ?? null },
      difyWorkflow: { available: Boolean(difyWorkflowRuntime.available), error: difyWorkflowRuntime.error ?? null },
      langflowAgent: { available: Boolean(langflowAgentRuntime.available), error: langflowAgentRuntime.error ?? null },
      langflowWorkflow: { available: Boolean(langflowWorkflowRuntime.available), error: langflowWorkflowRuntime.error ?? null },
    },
    counts: {
      agents: agents.length,
      activeAgents: agents.filter((a) => a.status === "active").length,
      workflows: workflows.length,
      activeWorkflows: workflows.filter((w) => w.status === "active").length,
      tools: tools.length,
      tasks: taskCounts.total,
      pendingApprovals: approvals.length,
    },
    memory: customerMemory.status(),
  };
}

// ------------------------------------------------------------
// Intent routing — the customer-facing entry point
// ------------------------------------------------------------
export interface RouteResult {
  ok: boolean;
  routedTo: string;
  intent: string;
  message: string;
  products: unknown[];
  run: AgentRunResult | null;
  dataState: "ok" | "not_enough_data" | "no_data" | "degraded";
  understanding: Record<string, unknown> | null;
  error?: string | null;
}

/**
 * Route a customer message to the right agent.
 * SKU lookup wins; design requests go to the designer; everything else goes to
 * the shopping assistant (which falls back to the recommendation agent).
 */
export async function routeIntent(req: {
  message: string;
  userId?: string | null;
  sessionId?: string | null;
  agentKey?: string;
}): Promise<RouteResult> {
  const message = String(req.message ?? "").trim();
  const understanding = message ? extractShoppingIntent(message) : null;
  const forced = req.agentKey;

  let target = forced ?? "shopping-assistant";
  let intent = "shopping";
  if (!forced) {
    if (understanding?.sku) {
      intent = "sku_lookup";
    } else if (understanding && !understanding.isShopping && isDesignRequest(message)) {
      target = "ai-designer";
      intent = "design";
    } else if (understanding && !understanding.isShopping) {
      intent = "general_chat";
    }
  }

  // Track the conversation turn as a real event (feeds the customer profile).
  if (message) {
    await recordEvent({
      userId: req.userId ?? null,
      sessionId: req.sessionId ?? null,
      eventType: intent === "design" ? "ai_design_start" : "chat_message",
      entityType: understanding?.categorySlug ? "category" : null,
      entityId: understanding?.sku ?? understanding?.categorySlug ?? null,
      metadata: { message: message.slice(0, 400), intent, target },
    }).catch(() => undefined as unknown as TrackResult);
  }

  const run = await runAgentByKey(target, {
    input: {
      message,
      query: message,
      sku: understanding?.sku ?? null,
      limit: 6,
    },
    userId: req.userId ?? null,
    sessionId: req.sessionId ?? null,
    triggeredBy: "orchestrator",
  });

  const output = (run.output ?? {}) as Record<string, unknown>;
  const products = Array.isArray(output.products) ? (output.products as unknown[]) : [];
  const fallbackText =
    run.ok && products.length === 0
      ? String(output.answer ?? output.summary ?? "در کاتالوگ واقعی Homeino مورد منطبقی پیدا نشد.")
      : String(output.answer ?? output.summary ?? (run.ok ? "" : run.error ?? "اجرا ناموفق بود"));

  return {
    ok: run.ok,
    routedTo: target,
    intent,
    message: fallbackText,
    products,
    run,
    dataState: (run.dataState ?? (run.ok ? "ok" : "no_data")) as RouteResult["dataState"],
    understanding: (output.understanding as Record<string, unknown>) ?? null,
    error: run.error ?? null,
  };
}

function isDesignRequest(message: string): boolean {
  return ["طراحی", "رندر", "دکور", "چیدمان", "بازطراحی", "design"].some((word) => message.includes(word));
}

// ------------------------------------------------------------
// Re-exported surface (single import point for API routes)
// ------------------------------------------------------------
export const orchestrator = {
  status: orchestratorStatus,
  routeIntent,
  runAgent: runAgentByKey,
  runAgentRuntime: (req: Parameters<typeof localAgentRuntime.run>[0]) => localAgentRuntime.run(req),
  cancelRun: cancelAgentRun,
  runWorkflow: (workflowKey: string, req: Parameters<typeof runWorkflow>[1] = {}) => runWorkflow(workflowKey, req),
  executeWorkflowByKey,
  resumeWorkflowRun,
  resolveWorkflowRuntime,
  localWorkflowRuntime,
  runWorkflowOnDify,
  runWorkflowOnLangflow,
  resolveBrowserRuntime: () => resolveBrowserRuntime(),
  tickScheduler,
  scheduleStatus,
  recordEvent: (event: TrackedEventInput) => recordEvent(event),
  recordEvents: async (events: TrackedEventInput[]) => {
    const out: TrackResult[] = [];
    for (const event of events) out.push(await recordEvent(event));
    return out;
  },
  eventStats,
  listAgents,
  listWorkflows,
  listTools: listToolRegistry,
  agentRegistryMeta,
  workflowBuilderMeta,
  tasks: { list: listTasks, create: createTask, retry: retryTask, cancel: cancelTask, summary: taskQueueSummary },
  approvals: { list: listApprovals, decide: decideApproval, expireStale: expireStaleApprovals },
  logs: { list: listExecutionLogs, summary: executionSummary },
  budgets: { check: checkRunBudget, status: getBudgetStatus, set: setBudget },
  memory: customerMemory,
  profile: effectiveProfile,
};

export type { AgentRunResult, WorkflowRunResult };
export { storeMode };
