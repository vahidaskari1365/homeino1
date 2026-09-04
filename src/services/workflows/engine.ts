// ============================================================
// HOMEINO — WORKFLOW ENGINE
//
// Executes a stored workflow graph node by node:
//   trigger · condition · agent · db_query · db_update · recommendation ·
//   notification · delay · schedule · human_approval · http_request ·
//   browser_task · end
//
// Every node produces a persisted step record (input/output/status/duration/
// tokens/cost), failed nodes retry with backoff, dangerous nodes pause for a
// human approval and can be resumed, and a run can be cancelled.
//
// Nothing here invents data: db_query/db_update only touch allowlisted reads
// and writes, and recommendation nodes go through the same catalog-verified
// engine the agents use.
// ============================================================
import type {
  RunStatus,
  TriggerKind,
  StepRecord,
  TokenUsage,
  WorkflowDefinition,
  WorkflowNodeDefinition,
  WorkflowNodeType,
  WorkflowRunRequest,
  WorkflowRunResult,
} from "../agents/types";
import { getStore } from "../agents/store";
import { runAgent, isRunCancelled } from "../agents/runtime";
import { generateRecommendations } from "../recommendations/recommendationEngine";
import { catalogPool, findCatalogProduct, lowStockCatalog, searchCatalog } from "../agents/catalog";
import { verifyRealProducts } from "../recommendations/productMatching";
import { runHttpTask } from "../agents/integrations/httpRuntime";
import { resolveBrowserRuntime } from "../agents/integrations/browserRuntime";
import { requestApproval } from "../automation/approvals";
import { effectiveProfile } from "../memory/preferenceEngine";
import { publicProduct } from "../agents/tools";

const MAX_STEPS = 60;
const MAX_DELAY_MS = 5000;
const NODE_RETRIES_DEFAULT = 1;
const MAX_OUTPUT_BYTES = 180_000;

interface EngineContext {
  workflow: WorkflowDefinition;
  runId: string;
  variables: Record<string, unknown>;
  toolsUsed: string[];
  usage: TokenUsage;
  userId: string | null;
  sessionId: string | null;
  actorRole: WorkflowRunRequest["actorRole"];
  log: (message: string) => void;
}

interface NodeOutcome {
  output?: Record<string, unknown>;
  outputKey?: string;
  value?: unknown;
  variables?: Record<string, unknown>;
  branch?: string | null;
  stop?: boolean;
  pause?: { approvalId: string; action: string; resume?: Record<string, unknown> };
  usage?: Partial<TokenUsage>;
  toolsUsed?: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------
/** Everything the engine needs — `workflowKey` comes from the definition itself. */
export type WorkflowRunInput = Omit<WorkflowRunRequest, "workflowKey" | "triggerKind"> & { triggerKind?: TriggerKind };

/** State needed to continue a run that paused on a human approval. */
export interface WorkflowResumeState {
  runId: string;
  /** Node to continue FROM — the one after the approved node. */
  fromNodeKey: string;
  variables: Record<string, unknown>;
  toolsUsed?: string[];
  usage?: Partial<TokenUsage>;
}

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  req: WorkflowRunInput,
  resume?: WorkflowResumeState,
): Promise<WorkflowRunResult> {
  const store = await getStore();
  const startedAt = Date.now();
  const runId = resume
    ? resume.runId
    : await store.createRun({
        workflowId: workflow.id ?? null,
        workflowKey: workflow.key,
        status: "running",
        triggerKind: req.triggerKind ?? "manual",
        triggerPayload: req.triggerPayload ?? {},
        input: req.input ?? {},
        userId: req.userId ?? null,
        sessionId: req.sessionId ?? null,
        maxAttempts: 1,
      });
  if (resume) await store.updateRun(runId, { status: "running", error: null, errorCode: null });

  const ctx: EngineContext = {
    workflow,
    runId,
    userId: req.userId ?? null,
    sessionId: req.sessionId ?? null,
    actorRole: req.actorRole ?? "system",
    variables: resume
      ? { ...resume.variables, now: new Date().toISOString() }
      : {
          trigger: { kind: req.triggerKind ?? "manual", ...(req.triggerPayload ?? {}) },
          input: req.input ?? {},
          event: (req.triggerPayload?.event as Record<string, unknown>) ?? null,
          user: { id: req.userId ?? null },
          session: { id: req.sessionId ?? null },
          workflow: { key: workflow.key, name: workflow.name },
          now: new Date().toISOString(),
        },
    toolsUsed: resume?.toolsUsed ? [...resume.toolsUsed] : [],
    usage: {
      provider: resume?.usage?.provider ?? "workflow-engine",
      model: workflow.key,
      tokensIn: resume?.usage?.tokensIn ?? 0,
      tokensOut: resume?.usage?.tokensOut ?? 0,
      costMicro: resume?.usage?.costMicro ?? 0,
      durationMs: 0,
    },
    log: () => undefined,
  };

  const steps: StepRecord[] = [];
  let status: RunStatus = "completed";
  let error: string | undefined;
  let errorCode: string | undefined;
  let dataState: WorkflowRunResult["dataState"] = "ok";

  const startNode = resume
    ? workflow.nodes.find((n) => n.key === resume.fromNodeKey)
    : workflow.nodes.find((n) => n.type === "trigger") ?? workflow.nodes[0];
  if (!startNode) {
    status = "failed";
    error = "ورک‌فلو هیچ گره‌ای ندارد";
    errorCode = "VALIDATION_FAILED";
  }

  let current: WorkflowNodeDefinition | undefined = startNode;
  let branch: string | null = null;
  let guard = 0;

  while (current && guard++ < MAX_STEPS && status === "completed") {
    if (isRunCancelled(runId) || (await isRunCancelledInStore(runId))) {
      status = "cancelled";
      error = "اجرا لغو شد";
      errorCode = "CANCELLED";
      break;
    }

    const stepStarted = Date.now();
    const attempts = Math.max(1, Number((current.config?.retries as number) ?? NODE_RETRIES_DEFAULT) + 1);
    let outcome: NodeOutcome | null = null;
    let stepError: string | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        outcome = await executeNode(current, ctx, attempt);
        stepError = undefined;
        break;
      } catch (err) {
        stepError = err instanceof Error ? err.message : String(err);
        if (attempt < attempts) await sleep(150 * 4 ** (attempt - 1));
      }
    }

    const step: StepRecord = {
      nodeKey: current.key,
      nodeType: current.type,
      label: current.label,
      agentKey: current.agentKey,
      status: stepError ? "failed" : outcome?.pause ? "waiting_approval" : outcome?.stop ? "completed" : "completed",
      attempt: attempts,
      input: compact({ node: current.config ?? {}, from: ctx.variables.input }) as Record<string, unknown>,
      output: compact(outcome?.output ?? {}) as Record<string, unknown>,
      error: stepError,
      tokensIn: outcome?.usage?.tokensIn ?? 0,
      tokensOut: outcome?.usage?.tokensOut ?? 0,
      costMicro: outcome?.usage?.costMicro ?? 0,
      startedAt: new Date(stepStarted).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - stepStarted,
    };
    steps.push(step);
    await store.addStep(runId, step);

    if (outcome?.usage) {
      ctx.usage.tokensIn += outcome.usage.tokensIn ?? 0;
      ctx.usage.tokensOut += outcome.usage.tokensOut ?? 0;
      ctx.usage.costMicro += outcome.usage.costMicro ?? 0;
      if (outcome.usage.provider) ctx.usage.provider = outcome.usage.provider;
    }
    if (outcome?.toolsUsed?.length) ctx.toolsUsed.push(...outcome.toolsUsed);

    if (stepError) {
      status = "failed";
      error = stepError;
      errorCode = "TOOL_FAILED";
      break;
    }

    if (outcome?.pause) {
      status = "waiting_approval";
      error = `منتظر تأیید انسانی: ${outcome.pause.action}`;
      errorCode = "APPROVAL_REQUIRED";
      await store.updateRun(runId, {
        status: "waiting_approval",
        output: { ...compactVariables(ctx.variables), __resume: { nodeKey: current.key, approvalId: outcome.pause.approvalId, resume: outcome.pause.resume ?? null } },
        error,
        errorCode,
        toolsUsed: [...new Set(ctx.toolsUsed)],
        tokensIn: ctx.usage.tokensIn,
        tokensOut: ctx.usage.tokensOut,
        costMicro: ctx.usage.costMicro,
      });
      return finalizeResult(workflow, runId, status, steps, ctx, startedAt, error, errorCode, dataState);
    }

    if (outcome?.variables) Object.assign(ctx.variables, outcome.variables);
    if (outcome?.outputKey) ctx.variables[outcome.outputKey] = outcome?.value ?? outcome?.output ?? null;
    if (typeof outcome?.output?.dataState === "string" && outcome.output.dataState !== "ok") {
      dataState = outcome.output.dataState as WorkflowRunResult["dataState"];
    }

    if (outcome?.stop || current.type === "end") break;

    branch = outcome?.branch ?? null;
    current = selectNextNode(workflow, current, branch);
  }

  if (guard >= MAX_STEPS && status === "completed") {
    status = "failed";
    error = `ورک‌فلو از حداکثر تعداد گام (${MAX_STEPS}) گذشت — احتمال حلقه`;
    errorCode = "INTERNAL";
  }

  await store.updateRun(runId, {
    status,
    output: compactVariables(ctx.variables),
    error: error ?? null,
    errorCode: errorCode ?? null,
    toolsUsed: [...new Set(ctx.toolsUsed)],
    tokensIn: ctx.usage.tokensIn,
    tokensOut: ctx.usage.tokensOut,
    costMicro: ctx.usage.costMicro,
    provider: ctx.usage.provider,
    model: ctx.usage.model,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  });
  await store.updateWorkflow(workflow.key, { lastRunAt: new Date().toISOString() });

  return finalizeResult(workflow, runId, status, steps, ctx, startedAt, error, errorCode, dataState);
}

export async function executeWorkflowByKey(key: string, req: WorkflowRunInput = {}): Promise<WorkflowRunResult> {
  const store = await getStore();
  const workflow = await store.getWorkflow(key);
  if (!workflow) {
    return {
      ok: false,
      status: "failed",
      workflowKey: key,
      output: {},
      steps: [],
      usage: { provider: "workflow-engine", model: key, tokensIn: 0, tokensOut: 0, costMicro: 0, durationMs: 0 },
      error: `ورک‌فلو پیدا نشد: ${key}`,
      errorCode: "VALIDATION_FAILED",
      dataState: "no_data",
    };
  }
  if (workflow.status !== "active" && req.triggerKind !== "manual") {
    return {
      ok: false,
      status: "failed",
      workflowKey: key,
      output: { status: workflow.status },
      steps: [],
      usage: { provider: "workflow-engine", model: key, tokensIn: 0, tokensOut: 0, costMicro: 0, durationMs: 0 },
      error: `ورک‌فلو فعال نیست (وضعیت: ${workflow.status})`,
      errorCode: "AGENT_INACTIVE",
      dataState: "no_data",
    };
  }
  return executeWorkflow(workflow, req);
}

/** Continue a run that paused on a human approval. */
export async function resumeWorkflowRun(runId: string, decision: "approved" | "rejected", decidedBy: string | null): Promise<WorkflowRunResult | null> {
  const store = await getStore();
  const run = await store.getRun(runId);
  if (!run || run.status !== "waiting_approval") return null;
  const resume = (run.output as { __resume?: { nodeKey: string; resume?: Record<string, unknown> } } | null)?.__resume;
  if (!resume) {
    await store.updateRun(runId, { status: decision === "approved" ? "completed" : "cancelled", finishedAt: new Date().toISOString() });
    return null;
  }

  if (decision === "rejected") {
    await store.updateRun(runId, { status: "cancelled", error: "تأیید انسانی رد شد", errorCode: "APPROVAL_REQUIRED", finishedAt: new Date().toISOString() });
    const steps = await store.listSteps(runId);
    return { ok: false, status: "cancelled", runId, workflowKey: run.workflowKey ?? "", output: run.output ?? {}, steps, usage: usageFromRun(run), error: "approval rejected" };
  }

  // Approved: execute the paused action, then continue from the next node.
  const workflow = run.workflowKey ? await store.getWorkflow(run.workflowKey) : null;
  if (!workflow) {
    await store.updateRun(runId, { status: "failed", error: "ورک‌فلو پیدا نشد", finishedAt: new Date().toISOString() });
    return null;
  }

  const pausedNode = workflow.nodes.find((n) => n.key === resume.nodeKey);
  const startedAt = Date.now();
  let output: Record<string, unknown> = { ...(run.output ?? {}) };
  delete output.__resume;

  if (pausedNode) {
    try {
      const result = await executeApprovedNode(pausedNode, resume.resume ?? {}, run);
      output = { ...output, [String(pausedNode.config?.outputKey ?? pausedNode.key)]: result };
      await store.addStep(runId, {
        nodeKey: pausedNode.key,
        nodeType: pausedNode.type,
        label: pausedNode.label,
        status: "completed",
        attempt: 1,
        input: compact(resume.resume ?? {}) as Record<string, unknown>,
        output: compact(result as Record<string, unknown>) as Record<string, unknown>,
        tokensIn: 0,
        tokensOut: 0,
        costMicro: 0,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      await store.updateRun(runId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        errorCode: "TOOL_FAILED",
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });
      const steps = await store.listSteps(runId);
      return { ok: false, status: "failed", runId, workflowKey: workflow.key, output, steps, usage: usageFromRun(run), error: String(error) };
    }
  }

  // Continue the graph from the node after the approved one (an approved run is
  // not finished just because the gate opened).
  const nextNode = pausedNode ? selectNextNode(workflow, pausedNode, null) : undefined;
  if (!nextNode) {
    await store.updateRun(runId, {
      status: "completed",
      output,
      error: null,
      errorCode: null,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    });
    const steps = await store.listSteps(runId);
    return { ok: true, status: "completed", runId, workflowKey: workflow.key, output, steps, usage: usageFromRun(run), dataState: "ok" };
  }

  const continued = await executeWorkflow(
    workflow,
    {
      triggerKind: run.triggerKind,
      triggerPayload: run.triggerPayload ?? {},
      input: run.input ?? {},
      userId: run.userId ?? null,
      sessionId: run.sessionId ?? null,
      actorRole: "admin",
      actorId: decidedBy,
    },
    { runId, fromNodeKey: nextNode.key, variables: output, toolsUsed: run.toolsUsed ?? [], usage: usageFromRun(run) },
  );
  const allSteps = await store.listSteps(runId);
  return { ...continued, steps: allSteps };
}

// ------------------------------------------------------------
// Node executors
// ------------------------------------------------------------
async function executeNode(node: WorkflowNodeDefinition, ctx: EngineContext, attempt: number): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  switch (node.type as WorkflowNodeType) {
    case "trigger":
      return executeTrigger(node, ctx);
    case "condition":
      return executeCondition(node, ctx);
    case "agent":
      return executeAgentNode(node, ctx);
    case "db_query":
      return executeDbQuery(node, ctx);
    case "db_update":
      return executeDbUpdate(node, ctx);
    case "recommendation":
      return executeRecommendationNode(node, ctx);
    case "notification":
      return executeNotificationNode(node, ctx);
    case "delay": {
      const ms = Math.min(Number(config.ms ?? 1000), MAX_DELAY_MS);
      await sleep(ms);
      return { output: { delayedMs: ms, capped: Number(config.ms ?? 0) > MAX_DELAY_MS } };
    }
    case "schedule":
      return { output: { schedule: config, nextRunAt: nextScheduleRun(config).toISOString() } };
    case "human_approval":
      return executeApprovalNode(node, ctx);
    case "http_request":
      return executeHttpNode(node, ctx);
    case "browser_task":
      return executeBrowserNode(node, ctx);
    case "end":
      return { output: { ended: true }, stop: true };
    default:
      void attempt;
      throw new Error(`نوع گره پشتیبانی‌نشده: ${String(node.type)}`);
  }
}

async function executeTrigger(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const eventTypes = Array.isArray(config.eventTypes) ? (config.eventTypes as string[]) : [];
  const variables: Record<string, unknown> = {};
  let eventCount = 0;

  if (eventTypes.length && (ctx.userId || ctx.sessionId)) {
    const store = await getStore();
    const windowMinutes = Number(ctx.workflow.trigger?.windowMinutes ?? 1440);
    const events = await store.listEvents({
      userId: ctx.userId ?? undefined,
      sessionId: ctx.sessionId ?? undefined,
      eventTypes,
      since: new Date(Date.now() - windowMinutes * 60_000),
      limit: 500,
    });
    eventCount = events.length;
    variables.events = events.slice(0, 50);
    variables.lastEvent = events[0] ?? null;
  }

  variables.eventCount = eventCount;
  return { output: { eventTypes, eventCount }, variables, outputKey: String(config.outputKey ?? "trigger"), value: { eventTypes, eventCount } };
}

function executeCondition(node: WorkflowNodeDefinition, ctx: EngineContext): NodeOutcome {
  const expression = String((node.config as Record<string, unknown>)?.expression ?? "true");
  const result = evaluateCondition(expression, ctx.variables);
  return { output: { expression, result }, branch: result ? "true" : "false" };
}

async function executeAgentNode(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const agentKey = node.agentKey ?? String(config.agentKey ?? "");
  if (!agentKey) throw new Error("گره ایجنت بدون agentKey");

  const store = await getStore();
  const agent = await store.getAgent(agentKey);
  if (!agent) throw new Error(`ایجنت پیدا نشد: ${agentKey}`);

  const inputFrom = String(config.inputFrom ?? "");
  const baseInput = inputFrom ? (ctx.variables[inputFrom] as Record<string, unknown>) ?? {} : {};
  const input: Record<string, unknown> = {
    ...(typeof baseInput === "object" && baseInput ? baseInput : {}),
    ...(typeof config.input === "object" && config.input ? (config.input as Record<string, unknown>) : {}),
    scenario: config.scenario ?? ctx.variables.scenario,
    limit: config.limit ?? ctx.variables.limit,
    threshold: config.threshold,
    seedProductId: config.seedFrom ? extractProductId(ctx.variables[String(config.seedFrom)]) : undefined,
    event: ctx.variables.event ?? undefined,
    workflowKey: ctx.workflow.key,
  };

  const result = await runAgent(agent, {
    agentKey,
    input: stripUndefined(input),
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    runId: ctx.runId,
    triggeredBy: `workflow:${ctx.workflow.key}`,
  });

  if (result.status === "waiting_approval") {
    return {
      output: result.output,
      pause: { approvalId: result.approval?.id ?? "", action: `agent:${agentKey}`, resume: { agentKey, input } },
      usage: result.usage,
      toolsUsed: result.toolsUsed,
    };
  }
  if (!result.ok) throw new Error(result.error ?? `ایجنت ${agentKey} شکست خورد`);

  return {
    output: result.output,
    outputKey: String(config.outputKey ?? agentKey.replace(/-/g, "_")),
    value: result.output,
    usage: result.usage,
    toolsUsed: result.toolsUsed,
  };
}

async function executeDbQuery(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const query = String(config.query ?? "products");
  const outputKey = String(config.outputKey ?? query);
  const store = await getStore();

  switch (query) {
    case "product": {
      const raw = String(config.from ?? "") ? resolvePath(ctx.variables, String(config.from)) : null;
      const id = typeof raw === "string" ? raw : String((raw as Record<string, unknown>)?.id ?? "");
      const product = id ? await findCatalogProduct({ id, slug: id }) : null;
      return { output: { found: Boolean(product), product: product ? publicProduct(product) : null }, outputKey, value: product ? publicProduct(product) : null };
    }
    case "products": {
      const items = await searchCatalog({
        q: config.q as string | undefined,
        categorySlug: config.categorySlug as string | undefined,
        styleSlug: config.styleSlug as string | undefined,
        minPrice: config.minPrice as number | undefined,
        maxPrice: config.maxPrice as number | undefined,
        inStockOnly: config.inStockOnly !== false,
        limit: Number(config.limit ?? 50),
      });
      return { output: { count: items.length, items: items.map(publicProduct) }, outputKey, value: { count: items.length, items: items.map(publicProduct) } };
    }
    case "low_stock": {
      const items = await lowStockCatalog(Number(config.threshold ?? 5));
      return { output: { count: items.length, items: items.map(publicProduct) }, outputKey, value: { count: items.length, items: items.map(publicProduct) } };
    }
    case "catalog_size": {
      const pool = await catalogPool();
      return { output: { count: pool.length }, outputKey, value: { count: pool.length } };
    }
    case "events": {
      const events = await store.listEvents({
        userId: ctx.userId ?? undefined,
        sessionId: ctx.sessionId ?? undefined,
        eventTypes: Array.isArray(config.eventTypes) ? (config.eventTypes as string[]) : undefined,
        limit: Number(config.limit ?? 200),
      });
      return { output: { count: events.length, events }, outputKey, value: { count: events.length, events } };
    }
    case "customer": {
      const profile = await effectiveProfile({ userId: ctx.userId, sessionId: ctx.sessionId });
      return { output: { dataState: profile?.dataState ?? "no_data", profile }, outputKey, value: profile };
    }
    case "recommendations": {
      const items = await store.listRecommendations({ userId: ctx.userId ?? undefined, sessionId: ctx.sessionId ?? undefined, scenario: config.scenario as string | undefined, limit: Number(config.limit ?? 24) });
      return { output: { count: items.length, items }, outputKey, value: { count: items.length, items } };
    }
    case "tasks": {
      const items = await store.listTasks({ status: config.status as never, limit: Number(config.limit ?? 50) });
      return { output: { count: items.length, items }, outputKey, value: { count: items.length, items } };
    }
    default:
      throw new Error(`کوئری مجاز نیست: ${query}`);
  }
}

async function executeDbUpdate(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const table = String(config.table ?? "");
  const store = await getStore();

  switch (table) {
    case "recommendations": {
      const source = String(config.from ?? "recommendations");
      const raw = resolvePath(ctx.variables, source);
      const items = extractRecommendationItems(raw);
      const { verified, rejected } = await verifyRealProducts(items);
      const persisted = await store.saveRecommendations({
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        scenario: String(config.scenario ?? ctx.variables.scenario ?? "home"),
        agentKey: String(config.agentKey ?? "workflow"),
        runId: ctx.runId,
        replace: config.replace !== false,
        items: verified.map((item, index) => ({
          productId: item.product.id,
          vendorId: null,
          score: item.score ?? 0,
          rank: item.rank ?? index + 1,
          reasonCode: item.reasonCode ?? "workflow",
          reasonText: item.reasonText ?? "پیشنهاد ورک‌فلو",
          breakdown: item.breakdown,
        })),
      });
      return { output: { table, persisted, rejected: rejected.length, dataState: persisted ? "ok" : "no_data" } };
    }
    case "customer_profile": {
      const source = String(config.from ?? "profile");
      const profile = resolvePath(ctx.variables, source);
      if (!ctx.userId) return { output: { table, persisted: 0, reason: "no_user" } };
      if (!profile || typeof profile !== "object") return { output: { table, persisted: 0, reason: "no_profile" } };
      await store.upsertProfile(profile as never);
      return { output: { table, persisted: 1 } };
    }
    case "task": {
      const taskId = await store.createTask({
        title: String(config.title ?? "وظیفه ورک‌فلو"),
        type: String(config.type ?? "workflow"),
        priority: Number(config.priority ?? 0),
        agentKey: ctx.workflow.key,
        workflowRunId: ctx.runId,
        userId: ctx.userId,
        payload: (resolvePath(ctx.variables, String(config.from ?? "input")) as Record<string, unknown>) ?? {},
        assigneeRole: String(config.assigneeRole ?? "admin"),
      });
      return { output: { table, taskId } };
    }
    default:
      throw new Error(`نوشتن روی «${table || "نامشخص"}» توسط ورک‌فلو مجاز نیست`);
  }
}

async function executeRecommendationNode(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const scenario = String(config.scenario ?? "home");
  const seedFrom = config.seedFrom ? String(config.seedFrom) : null;
  const seedProductId = seedFrom ? extractProductId(resolvePath(ctx.variables, seedFrom)) : null;

  const result = await generateRecommendations({
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    scenario,
    limit: Number(config.limit ?? 12),
    seedProductId,
    persist: config.persist !== false,
    agentKey: node.agentKey ?? "recommendation",
    runId: ctx.runId,
  });

  return {
    output: {
      dataState: result.dataState,
      scenario,
      count: result.items.length,
      persisted: result.persisted,
      source: result.source,
      items: result.items.map((item) => ({ ...publicProduct(item.product), score: item.score, rank: item.rank, reasonCode: item.reasonCode, reasonText: item.reasonText })),
    },
    outputKey: String(config.outputKey ?? "recommendations"),
    value: {
      dataState: result.dataState,
      count: result.items.length,
      persisted: result.persisted,
      items: result.items.map((item) => ({ ...publicProduct(item.product), score: item.score, rank: item.rank, reasonCode: item.reasonCode, reasonText: item.reasonText })),
    },
  };
}

async function executeNotificationNode(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const store = await getStore();
  const audience = String(config.audience ?? "admin");
  const from = config.from ? resolvePath(ctx.variables, String(config.from)) : null;
  const count = typeof (from as { count?: number })?.count === "number" ? Number((from as { count?: number }).count) : Array.isArray(from) ? from.length : 0;
  const title = String(config.title ?? "اعلان ورک‌فلو");

  const taskId = await store.createTask({
    title: count ? `${title} (${count} مورد)` : title,
    type: "notification",
    agentKey: ctx.workflow.key,
    workflowRunId: ctx.runId,
    userId: audience === "user" ? ctx.userId : null,
    assigneeRole: audience === "vendor" ? "vendor" : "admin",
    payload: { audience, title, body: String(config.body ?? ""), count, from: compact(from ?? {}) },
  });
  return { output: { audience, title, count, taskId }, toolsUsed: ["sendNotification"] };
}

async function executeApprovalNode(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const action = String(config.action ?? `workflow:${ctx.workflow.key}:${node.key}`);
  const approvalId = await requestApproval({
    agentKey: String(config.agentKey ?? ctx.workflow.key),
    action,
    reason: String(config.reason ?? "گره تأیید انسانی در ورک‌فلو"),
    riskLevel: (["low", "medium", "high", "critical"].includes(String(config.risk ?? "")) ? String(config.risk) : "high") as "low" | "medium" | "high" | "critical",
    payload: { workflowKey: ctx.workflow.key, runId: ctx.runId, nodeKey: node.key, context: compactVariables(ctx.variables) },
    runId: ctx.runId,
    expiresHours: Number(config.expiresHours ?? 72),
  });
  return { output: { approvalId, action }, pause: { approvalId, action, resume: { nodeKey: node.key } } };
}

async function executeHttpNode(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const url = String(resolvePath(ctx.variables, String(config.url ?? "")) ?? config.url ?? "");
  if (!url) throw new Error("گره HTTP بدون url");
  const requireApproval = config.requireApproval !== false;

  if (requireApproval) {
    const approvalId = await requestApproval({
      agentKey: ctx.workflow.key,
      action: "tool:httpRequest",
      reason: `درخواست HTTP به ${url}`,
      riskLevel: "high",
      payload: { url, method: String(config.method ?? "GET"), body: config.body ?? null, nodeKey: node.key },
      runId: ctx.runId,
    });
    return { output: { approvalId, url, pendingApproval: true }, pause: { approvalId, action: `http:${url}`, resume: { url, method: String(config.method ?? "GET"), body: config.body ?? null } } };
  }

  const result = await runHttpTask({
    url,
    method: String(config.method ?? "GET"),
    body: config.body as Record<string, unknown> | undefined,
    allowedDomains: Array.isArray(config.allowedDomains) ? (config.allowedDomains as string[]) : [],
  });
  if (!result.ok) throw new Error(result.error ?? `HTTP request failed: ${url}`);
  return { output: { url, status: result.status, contentType: result.contentType, json: result.json ?? null, excerpt: result.excerpt }, toolsUsed: ["httpRequest"] };
}

async function executeBrowserNode(node: WorkflowNodeDefinition, ctx: EngineContext): Promise<NodeOutcome> {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const url = String(resolvePath(ctx.variables, String(config.url ?? "")) ?? config.url ?? "");
  const instruction = String(config.instruction ?? "");
  if (!url || !instruction) throw new Error("گره مرورگر به url و instruction نیاز دارد");
  const allowedDomains = Array.isArray(config.allowedDomains) ? (config.allowedDomains as string[]) : [];

  const approvalId = await requestApproval({
    agentKey: ctx.workflow.key,
    action: "tool:browserTask",
    reason: `وظیفه مرورگر روی ${url}: ${instruction.slice(0, 120)}`,
    riskLevel: "high",
    payload: { url, instruction, action: String(config.action ?? "extract"), allowedDomains, nodeKey: node.key },
    runId: ctx.runId,
  });
  return {
    output: { approvalId, url, pendingApproval: true },
    pause: { approvalId, action: `browser:${url}`, resume: { url, instruction, action: String(config.action ?? "extract"), allowedDomains, maxSteps: Number(config.maxSteps ?? 8) } },
  };
}

async function executeApprovedNode(node: WorkflowNodeDefinition, resume: Record<string, unknown>, run: { userId?: string | null; id?: string }): Promise<Record<string, unknown>> {
  if (node.type === "http_request") {
    const result = await runHttpTask({
      url: String(resume.url ?? ""),
      method: String(resume.method ?? "GET"),
      body: resume.body as Record<string, unknown> | undefined,
    });
    return { url: result.url, status: result.status, json: result.json ?? null, excerpt: result.excerpt, ok: result.ok };
  }
  if (node.type === "browser_task") {
    const runtime = resolveBrowserRuntime();
    const result = await runtime.run({
      url: String(resume.url ?? ""),
      instruction: String(resume.instruction ?? ""),
      action: (resume.action as "goto" | "act" | "extract" | "observe") ?? "extract",
      allowedDomains: Array.isArray(resume.allowedDomains) ? (resume.allowedDomains as string[]) : [],
      maxSteps: Number(resume.maxSteps ?? 8),
      agentKey: node.agentKey ?? "browser",
      runId: run.id ?? null,
    });
    return { ...result };
  }
  if (node.type === "agent" && typeof resume.agentKey === "string") {
    const store = await getStore();
    const agent = await store.getAgent(resume.agentKey);
    if (!agent) return { ok: false, error: "agent_not_found" };
    const result = await runAgent(agent, {
      agentKey: agent.key,
      input: (resume.input as Record<string, unknown>) ?? {},
      userId: run.userId ?? null,
      runId: run.id ?? null,
      triggeredBy: "approval_resume",
    });
    return result.output;
  }
  return { resumed: true, nodeKey: node.key };
}

// ------------------------------------------------------------
// Graph helpers
// ------------------------------------------------------------
function selectNextNode(workflow: WorkflowDefinition, node: WorkflowNodeDefinition, branch: string | null): WorkflowNodeDefinition | undefined {
  const outgoing = workflow.edges.filter((e) => e.from === node.key);
  if (!outgoing.length) return undefined;
  if (branch !== null) {
    const matching = outgoing.find((e) => (e.label ?? null) === branch);
    if (matching) return workflow.nodes.find((n) => n.key === matching.to);
    const unlabeled = outgoing.find((e) => !e.label);
    if (unlabeled) return workflow.nodes.find((n) => n.key === unlabeled.to);
    return undefined;
  }
  const unlabeled = outgoing.find((e) => !e.label) ?? outgoing[0];
  return workflow.nodes.find((n) => n.key === unlabeled.to);
}

/**
 * Tiny, safe condition evaluator (no eval, no Function).
 * Supported: `path >= 3`, `path == "x"`, `path contains "x"`, `path exists`,
 * combined with && and ||. `path` may be dotted and may end with .length/.count.
 */
export function evaluateCondition(expression: string, variables: Record<string, unknown>): boolean {
  const expr = String(expression ?? "").trim();
  if (!expr || expr === "true") return true;
  if (expr === "false") return false;

  return expr
    .split("||")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((orPart) =>
      orPart
        .split("&&")
        .map((p) => p.trim())
        .filter(Boolean)
        .every((clause) => evaluateClause(clause, variables)),
    );
}

function evaluateClause(clause: string, variables: Record<string, unknown>): boolean {
  const operators = [">=", "<=", "==", "!=", ">", "<", " contains ", " exists", " not_exists"];
  for (const op of operators) {
    const index = clause.indexOf(op);
    if (index === -1) continue;
    const path = clause.slice(0, index).trim();
    const rawRight = clause.slice(index + op.length).trim();
    const value = resolvePath(variables, path);
    const operator = op.trim();

    if (operator === "exists") return value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0);
    if (operator === "not_exists") return value === undefined || value === null || (Array.isArray(value) && value.length === 0);

    const right = parseLiteral(rawRight);
    const leftNumber = toNumber(value);
    const rightNumber = toNumber(right);

    if (operator === "contains") {
      if (Array.isArray(value)) return value.some((v) => String(v) === String(right));
      return String(value ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
    }
    if (leftNumber !== null && rightNumber !== null) {
      switch (operator) {
        case ">=": return leftNumber >= rightNumber;
        case "<=": return leftNumber <= rightNumber;
        case ">": return leftNumber > rightNumber;
        case "<": return leftNumber < rightNumber;
        case "==": return leftNumber === rightNumber;
        case "!=": return leftNumber !== rightNumber;
      }
    }
    switch (operator) {
      case "==": return String(value ?? "") === String(right ?? "");
      case "!=": return String(value ?? "") !== String(right ?? "");
      default: return false;
    }
  }
  // A bare path is truthy-check.
  const value = resolvePath(variables, clause);
  return Boolean(value);
}

function parseLiteral(raw: string): unknown {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) return value.slice(1, -1);
  const numeric = Number(value.replace(/[^\d.\-]/g, ""));
  return Number.isFinite(numeric) && /^-?[\d.]+$/.test(value) ? numeric : value;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.count === "number") return record.count;
    if (Array.isArray(record.items)) return record.items.length;
    return null;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

export function resolvePath(variables: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = variables;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (part === "length" && Array.isArray(current)) return current.length;
    if (part === "count") {
      if (Array.isArray(current)) return current.length;
      if (typeof current === "object" && "count" in (current as Record<string, unknown>)) return (current as Record<string, unknown>).count;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function extractProductId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const record = value as Record<string, unknown>;
  const id = record.productId ?? record.id ?? record.entityId;
  return typeof id === "string" && id ? id : null;
}

function extractRecommendationItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.recommendations)) return record.recommendations;
    if (record.productId || record.id) return [record];
  }
  return [];
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) if (value !== undefined) out[key] = value;
  return out;
}

/** Bound the size of anything we persist in a run row. */
function compact(value: unknown, maxItems = 25): unknown {
  if (Array.isArray(value)) {
    const trimmed = value.slice(0, maxItems).map((item) => compact(item, maxItems));
    return value.length > maxItems ? [...trimmed, { _truncated: value.length - maxItems }] : trimmed;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = compact(entry, maxItems);
    return out;
  }
  if (typeof value === "string" && value.length > 800) return `${value.slice(0, 800)}…`;
  return value;
}

function compactVariables(variables: Record<string, unknown>): Record<string, unknown> {
  const compacted = compact(variables) as Record<string, unknown>;
  try {
    const json = JSON.stringify(compacted ?? {});
    if (json.length <= MAX_OUTPUT_BYTES) return compacted;
    // Second pass with a much tighter item cap.
    return compact(variables, 5) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function isRunCancelledInStore(runId: string): Promise<boolean> {
  try {
    const store = await getStore();
    const run = await store.getRun(runId);
    return run?.status === "cancelled";
  } catch {
    return false;
  }
}

function usageFromRun(run: { tokensIn: number; tokensOut: number; costMicro: number; provider?: string | null; model?: string | null; durationMs?: number | null }): TokenUsage {
  return {
    provider: run.provider ?? "workflow-engine",
    model: run.model ?? "",
    tokensIn: run.tokensIn ?? 0,
    tokensOut: run.tokensOut ?? 0,
    costMicro: run.costMicro ?? 0,
    durationMs: run.durationMs ?? 0,
  };
}

function finalizeResult(
  workflow: WorkflowDefinition,
  runId: string,
  status: RunStatus,
  steps: StepRecord[],
  ctx: EngineContext,
  startedAt: number,
  error?: string,
  errorCode?: string,
  dataState?: WorkflowRunResult["dataState"],
): WorkflowRunResult {
  const usage: TokenUsage = { ...ctx.usage, durationMs: Date.now() - startedAt };
  return {
    ok: status === "completed",
    status,
    runId,
    workflowKey: workflow.key,
    output: compactVariables(ctx.variables),
    steps,
    usage,
    error,
    errorCode: errorCode as WorkflowRunResult["errorCode"],
    dataState: dataState ?? "ok",
  };
}

/** Next run time for a schedule node/config (also used by the scheduler). */
export function nextScheduleRun(schedule: unknown, from = new Date()): Date {
  const config = (schedule ?? {}) as Record<string, unknown>;
  const kind = String(config.kind ?? "manual");
  if (kind === "interval") {
    const minutes = Math.max(1, Number(config.everyMinutes ?? 60));
    return new Date(from.getTime() + minutes * 60_000);
  }
  if (kind === "daily" || kind === "weekly") {
    const [hour, minute] = String(config.at ?? "09:00").split(":").map((v) => Number(v));
    const next = new Date(from);
    next.setUTCHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
    if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    if (kind === "weekly") {
      const weekday = typeof config.weekday === "number" ? config.weekday : ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(String(config.weekday ?? "monday").toLowerCase());
      const target = Number.isFinite(weekday) ? weekday : 1;
      while (next.getUTCDay() !== target) next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
  // manual / cron / unknown → no automatic next run
  return new Date(from.getTime() + 365 * 86_400_000);
}
