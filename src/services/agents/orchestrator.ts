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
import { findCatalogProduct } from "./catalog";
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

export interface RouteIntentRequest {
  message: string;
  userId?: string | null;
  sessionId?: string | null;
  agentKey?: string;
  /** Recent conversation turns (role + text) for multi-turn continuity. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Page/product context built by the UI (e.g. «محصول: … id … sku … slug …»). */
  context?: string;
}

/** Detect a price-comparison follow-up («ارزون‌ترش داری؟», «چیزی ارزون‌تر هست؟»). */
function isFollowUpCheaper(message: string): boolean {
  return /ارزون‌?تر|ارزان‌?تر|کمتر (از )?(قیمت|این)|cheaper|economical/.test(message);
}

/**
 * Continuation WITHOUT server-side state: the caller sends the recent turns in
 * `history`, and a cheaper follow-up is expanded by replaying the LAST user
 * query with a lowered budget clause («زیر ۲۰ میلیون» → «زیر ۱۶ میلیون»).
 * NLU then sees a full shopping request — no memory map needed.
 */
function lowerBudgetClause(text: string): string {
  return text.replace(
    /(زیر|کمتر از|حداکثر|نه بیشتر از|تا)\s*([۰-۹0-9][۰-۹0-9٬,،]*(?:\.\d+)?)\s*(میلیون|میلیارد|تومان|هزار)/g,
    (_m, pre: string, numStr: string, unit: string) => {
      const digits = Number(numStr.replace(/[۰-۹٠-٩]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[٬,،\s]/g, ""));
      if (!Number.isFinite(digits) || digits <= 0) return _m;
      const next = Math.max(1, Math.round((digits * 0.8) / (unit === "هزار" ? 100 : 1)) * (unit === "هزار" ? 100 : 1));
      return `${pre} ${next.toLocaleString("fa-IR")} ${unit}`;
    },
  );
}

function expandCheaperFollowUp(message: string, history: { role: string; content: string }[]): string {
  if (!isFollowUpCheaper(message)) return message;
  // Walk backwards for the previous USER turn that carried a budget.
  for (const turn of [...history].reverse()) {
    if (turn.role !== "user") continue;
    if (!/[0-9۰-۹٠-٩]/.test(turn.content)) continue; // Persian or Latin digits
    const lowered = lowerBudgetClause(turn.content);
    if (lowered !== turn.content) return lowered;
  }
  return message;
}

/** «محصول: نام محصول (id: p1، sku: SOF-1024، slug: sofa-x)» → structured product context.
 *  slug is optional (older clients omit it) — it lets the server resolve
 *  DB-only products the static client catalog does not know. */
export function parseProductContext(context?: string): { name: string; id: string; sku: string; slug: string } | null {
  if (!context || !context.startsWith("محصول:")) return null;
  const rest = context.slice("محصول:".length).trim();
  const metaMatch = /\((?:id|sku|slug):/.exec(rest);
  const bracket = metaMatch ? metaMatch.index : -1;
  const name = (bracket >= 0 ? rest.slice(0, bracket) : rest).replace(/[—–-]\s*$/, "").trim();
  const meta = bracket >= 0 ? rest.slice(bracket) : rest;
  const id = /id:\s*([A-Za-z0-9_-]+)/i.exec(meta)?.[1] ?? "";
  const sku = /sku:\s*([A-Za-z0-9_-]+)/i.exec(meta)?.[1] ?? "";
  const slug = /slug:\s*([A-Za-z0-9_-]+)/i.exec(meta)?.[1] ?? "";
  return name || id || sku || slug ? { name, id, sku, slug } : null;
}

/** True when the turn explicitly refers to «این محصول» (the PDP context product). */
function wantsCurrentProduct(message: string): boolean {
  return /این محصول|همین محصول|این کالا/.test(message) && /قیمت|شرایط|condition|مشخصات|موجودی|ارسال|تحویل|خرید/.test(message);
}
/**
 * Route a customer message to the right agent.
 * SKU lookup wins; design requests go to the designer; everything else goes to
 * the shopping assistant (which falls back to the recommendation agent).
 */
export async function routeIntent(req: RouteIntentRequest): Promise<RouteResult> {
  let message = String(req.message ?? "").trim();
  const forced = req.agentKey;
  const productContext = parseProductContext(req.context);
  const history = (req.history ?? []).slice(-8);
  const wantsPdpProduct = wantsCurrentProduct(message) && Boolean(productContext?.sku || productContext?.slug);

  // Cheap follow-up rewriting happens BEFORE parsing so the NLU sees a full
  // shopping query («ارزون‌ترش داری؟» → previous query with a lowered budget).
  if (!forced) {
    message = expandCheaperFollowUp(message, history);
  }

  let understanding = message ? extractShoppingIntent(message) : null;

  // Product-page context («قیمت و شرایط این محصول») → resolve the REAL catalog
  // product from sku OR slug against the live DB pool, then treat as exact
  // lookup. The client context may carry a static id that only exists in the
  // DB under a different uuid — the resolved row's own sku is authoritative.
  if (wantsPdpProduct && understanding) {
    const resolved = (productContext?.sku || productContext?.slug)
      ? await findCatalogProduct({ sku: productContext!.sku || null, slug: productContext!.slug || null }).catch(() => undefined)
      : undefined;
    understanding = {
      ...understanding,
      sku: resolved?.sku ?? (productContext!.sku || null),
      isShopping: true,
      summary: productContext?.name ? `محصول ${productContext.name}` : (understanding.summary || ""),
    };
  }

  let target = forced ?? "shopping-assistant";
  let intent = "shopping";
  if (!forced) {
    if (understanding?.sku) {
      intent = "sku_lookup";
    } else if (understanding && !understanding.isShopping && isDesignRequest(message)) {
      target = "designer"; // the seeded agent key is `designer` (was "ai-designer" → AGENT_NOT_FOUND)
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
      // Continuation + product-page grounding the handlers can use.
      history,
      contextProduct: productContext,
      isPdpInquiry: wantsPdpProduct,
    },
    userId: req.userId ?? null,
    sessionId: req.sessionId ?? null,
    triggeredBy: "orchestrator",
    context: { history, pageContext: req.context ?? null },
  });

  const output = (run.output ?? {}) as Record<string, unknown>;
  const products = Array.isArray(output.products)
    ? (output.products as unknown[])
    : Array.isArray(output.matchedProducts)
      ? (output.matchedProducts as unknown[])
      : [];
  const rawText = output.answer ?? output.message ?? output.summary ?? null;
  const fallbackText =
    typeof rawText === "string" && rawText.trim()
      ? rawText
      : run.ok
        ? products.length
          ? ""
          : "در کاتالوگ واقعی Homeino مورد منطبقی پیدا نشد."
        : (run.error ?? "اجرا ناموفق بود");

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
