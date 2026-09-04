// ============================================================
// HOMEINO — IN-PROCESS AGENT STORE
//
// Used when DATABASE_URL is not configured (local dev, previews, tests) so the
// orchestrator stays fully functional. Data lives for the lifetime of the
// process (survives Next.js hot reloads via globalThis). Nothing here invents
// catalog entities — recommendations still reference real catalog ids.
// ============================================================
import { randomUUID } from "node:crypto";
import type {
  AgentDefinition,
  AgentSchedule,
  CustomerProfileSnapshot,
  MemoryKind,
  MemoryRecord,
  RunStatus,
  StepRecord,
  WorkflowDefinition,
} from "../types";
import type {
  AgentPatch,
  AgentRunRecord,
  AgentStore,
  ApprovalRecord,
  BudgetRecord,
  EventRecord,
  IntegrationRecord,
  NewAgentInput,
  NewWorkflowInput,
  RecommendationRecord,
  RunRecord,
  TaskLogRecord,
  TaskRecord,
  ToolRecord,
  WorkflowPatch,
} from "./types";

interface MemoryState {
  agents: AgentDefinition[];
  tools: ToolRecord[];
  workflows: WorkflowDefinition[];
  runs: RunRecord[];
  agentRuns: AgentRunRecord[];
  tasks: TaskRecord[];
  taskLogs: TaskLogRecord[];
  approvals: ApprovalRecord[];
  profiles: Map<string, CustomerProfileSnapshot>;
  memories: MemoryRecord[];
  recommendations: RecommendationRecord[];
  events: EventRecord[];
  budgets: BudgetRecord[];
  integrations: IntegrationRecord[];
  /** runId → step list (kept in insertion order). */
  stepsByRun: Map<string, StepRecord[]>;
}

const globalForStore = globalThis as typeof globalThis & { __homeinoAgentStore?: MemoryState };

function state(): MemoryState {
  const existing = globalForStore.__homeinoAgentStore;
  if (existing) return existing;
  const fresh: MemoryState = {
    agents: [],
    tools: [],
    workflows: [],
    runs: [],
    agentRuns: [],
    tasks: [],
    taskLogs: [],
    approvals: [],
    profiles: new Map(),
    memories: [],
    recommendations: [],
    events: [],
    budgets: [],
    integrations: [],
    stepsByRun: new Map(),
  };
  globalForStore.__homeinoAgentStore = fresh;
  return fresh;
}

/** Test/dev helper — wipes the in-process store. */
export function resetMemoryStore() {
  globalForStore.__homeinoAgentStore = undefined;
}

const now = () => new Date().toISOString();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;

function matchAgent(a: AgentDefinition, keyOrId: string) {
  return a.key === keyOrId || a.id === keyOrId;
}

function matchWorkflow(w: WorkflowDefinition, keyOrId: string) {
  return w.key === keyOrId || w.id === keyOrId;
}

export const memoryAgentStore: AgentStore = {
  mode: "memory",

  // ---- agents ----
  async listAgents() {
    return clone(state().agents).sort((a, b) => a.name.localeCompare(b.name, "fa"));
  },
  async getAgent(keyOrId) {
    const found = state().agents.find((a) => matchAgent(a, keyOrId));
    return found ? clone(found) : null;
  },
  async createAgent(input: NewAgentInput) {
    const s = state();
    if (s.agents.some((a) => a.key === input.key)) {
      throw new Error(`agent key already exists: ${input.key}`);
    }
    const agent: AgentDefinition = {
      id: randomUUID(),
      key: input.key,
      name: input.name,
      description: input.description,
      type: input.type,
      status: input.status ?? "draft",
      model: input.model,
      runtime: input.runtime ?? "local",
      systemPrompt: input.systemPrompt,
      handler: input.handler,
      config: input.config ?? {},
      schedule: input.schedule ?? null,
      maxRetries: input.maxRetries ?? 2,
      timeoutMs: input.timeoutMs ?? 30000,
      maxCostMicro: input.maxCostMicro ?? 0,
      tools: input.tools ?? [],
      permissions: input.permissions ?? [],
      isBuiltin: input.isBuiltin ?? false,
      createdAt: now(),
      updatedAt: now(),
    };
    s.agents.push(agent);
    return clone(agent);
  },
  async updateAgent(keyOrId, patch: AgentPatch) {
    const s = state();
    const agent = s.agents.find((a) => matchAgent(a, keyOrId));
    if (!agent) return null;
    Object.assign(agent, clone(patch), { updatedAt: now() });
    return clone(agent);
  },
  async deleteAgent(keyOrId) {
    const s = state();
    const before = s.agents.length;
    s.agents = s.agents.filter((a) => !matchAgent(a, keyOrId));
    return s.agents.length < before;
  },

  // ---- tools ----
  async listTools() {
    return clone(state().tools);
  },

  // ---- workflows ----
  async listWorkflows() {
    return clone(state().workflows).sort((a, b) => a.name.localeCompare(b.name, "fa"));
  },
  async getWorkflow(keyOrId) {
    const found = state().workflows.find((w) => matchWorkflow(w, keyOrId));
    return found ? clone(found) : null;
  },
  async createWorkflow(input: NewWorkflowInput) {
    const s = state();
    if (s.workflows.some((w) => w.key === input.key)) {
      throw new Error(`workflow key already exists: ${input.key}`);
    }
    const wf: WorkflowDefinition = {
      id: randomUUID(),
      key: input.key,
      name: input.name,
      description: input.description,
      status: input.status ?? "draft",
      runtime: input.runtime ?? "local",
      version: 1,
      triggerKind: input.triggerKind ?? "manual",
      trigger: input.trigger ?? {},
      schedule: input.schedule ?? null,
      config: input.config ?? {},
      nodes: clone(input.nodes),
      edges: clone(input.edges),
      isBuiltin: input.isBuiltin ?? false,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    s.workflows.push(wf);
    return clone(wf);
  },
  async updateWorkflow(keyOrId, patch: WorkflowPatch) {
    const s = state();
    const wf = s.workflows.find((w) => matchWorkflow(w, keyOrId));
    if (!wf) return null;
    Object.assign(wf, clone(patch), { updatedAt: now() });
    if (patch.nodes || patch.edges) wf.version = (wf.version ?? 1) + 1;
    return clone(wf);
  },
  async deleteWorkflow(keyOrId) {
    const s = state();
    const before = s.workflows.length;
    s.workflows = s.workflows.filter((w) => !matchWorkflow(w, keyOrId));
    return s.workflows.length < before;
  },

  // ---- runs ----
  async createRun(input) {
    const s = state();
    const run: RunRecord = {
      id: randomUUID(),
      workflowId: input.workflowId ?? null,
      workflowKey: input.workflowKey ?? null,
      status: input.status ?? "queued",
      triggerKind: input.triggerKind,
      triggerPayload: input.triggerPayload ?? {},
      input: input.input ?? {},
      output: null,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      attempt: 1,
      maxAttempts: input.maxAttempts ?? 1,
      error: null,
      errorCode: null,
      toolsUsed: [],
      tokensIn: 0,
      tokensOut: 0,
      costMicro: 0,
      model: null,
      provider: null,
      startedAt: now(),
      finishedAt: null,
      durationMs: null,
    };
    s.runs.push(run);
    s.stepsByRun.set(run.id, []);
    return run.id;
  },
  async updateRun(id, patch) {
    const run = state().runs.find((r) => r.id === id);
    if (!run) return;
    Object.assign(run, clone(patch));
  },
  async getRun(id) {
    const run = state().runs.find((r) => r.id === id);
    return run ? clone(run) : null;
  },
  async listRuns(filter) {
    const limit = filter?.limit ?? 50;
    return clone(
      state()
        .runs.filter((r) => (!filter?.workflowKey || r.workflowKey === filter.workflowKey) && (!filter?.status || r.status === filter.status))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit),
    );
  },
  async addStep(runId, step) {
    const s = state();
    const list = s.stepsByRun.get(runId) ?? [];
    list.push(clone(step));
    s.stepsByRun.set(runId, list);
  },
  async listSteps(runId) {
    return clone(state().stepsByRun.get(runId) ?? []);
  },

  // ---- agent runs ----
  async logAgentRun(record) {
    const s = state();
    const id = record.id ?? randomUUID();
    s.agentRuns.push({ ...clone(record), id } as AgentRunRecord);
    if (s.agentRuns.length > 2000) s.agentRuns.splice(0, s.agentRuns.length - 2000);
    return id;
  },
  async listAgentRuns(filter) {
    const limit = filter?.limit ?? 50;
    return clone(
      state()
        .agentRuns.filter(
          (r) =>
            (!filter?.agentKey || r.agentKey === filter.agentKey) &&
            (!filter?.runId || r.runId === filter.runId) &&
            (!filter?.status || r.status === filter.status),
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, limit),
    );
  },

  // ---- tasks ----
  async createTask(input) {
    const s = state();
    const task: TaskRecord = {
      id: randomUUID(),
      title: input.title,
      type: input.type ?? "generic",
      status: input.status ?? "pending",
      priority: input.priority ?? 0,
      agentKey: input.agentKey ?? null,
      workflowRunId: input.workflowRunId ?? null,
      userId: input.userId ?? null,
      vendorId: input.vendorId ?? null,
      productId: input.productId ?? null,
      payload: input.payload ?? {},
      result: null,
      error: null,
      attempt: 0,
      maxAttempts: input.maxAttempts ?? 3,
      assigneeRole: input.assigneeRole ?? "admin",
      dueAt: input.dueAt ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    s.tasks.push(task);
    return task.id;
  },
  async getTask(id) {
    const task = state().tasks.find((t) => t.id === id);
    return task ? clone(task) : null;
  },
  async listTasks(filter) {
    const limit = filter?.limit ?? 100;
    return clone(
      state()
        .tasks.filter((t) => (!filter?.status || t.status === filter.status) && (!filter?.agentKey || t.agentKey === filter.agentKey))
        .sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  },
  async updateTask(id, patch) {
    const task = state().tasks.find((t) => t.id === id);
    if (!task) return;
    Object.assign(task, clone(patch), { updatedAt: now() });
  },
  async addTaskLog(taskId, level, message, meta) {
    state().taskLogs.push({ id: randomUUID(), taskId, level, message, meta: meta ?? {}, createdAt: now() });
  },
  async listTaskLogs(taskId) {
    return clone(state().taskLogs.filter((l) => l.taskId === taskId));
  },

  // ---- approvals ----
  async createApproval(input) {
    const s = state();
    const approval: ApprovalRecord = {
      id: randomUUID(),
      agentKey: input.agentKey ?? null,
      taskId: input.taskId ?? null,
      runId: input.runId ?? null,
      action: input.action,
      reason: input.reason ?? null,
      riskLevel: input.riskLevel,
      payload: input.payload ?? {},
      status: "pending",
      requestedBy: null,
      decidedBy: null,
      decisionNote: null,
      expiresAt: input.expiresAt ?? null,
      decidedAt: null,
      createdAt: now(),
    };
    s.approvals.push(approval);
    return approval.id;
  },
  async listApprovals(filter) {
    const limit = filter?.limit ?? 100;
    return clone(
      state()
        .approvals.filter((a) => !filter?.status || a.status === filter.status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  },
  async getApproval(id) {
    const found = state().approvals.find((a) => a.id === id);
    return found ? clone(found) : null;
  },
  async decideApproval(id, decision, decidedBy, note) {
    const approval = state().approvals.find((a) => a.id === id);
    // Only a pending approval can be decided — same rule as the database adapter.
    if (!approval || approval.status !== "pending") return null;
    approval.status = decision;
    approval.decidedBy = decidedBy;
    approval.decisionNote = note ?? null;
    approval.decidedAt = now();
    return clone(approval);
  },

  async expireApproval(id) {
    const approval = state().approvals.find((a) => a.id === id);
    if (!approval || approval.status !== "pending") return null;
    approval.status = "expired";
    approval.decisionNote = "منقضی شد";
    approval.decidedAt = now();
    return clone(approval);
  },

  // ---- customer intelligence ----
  async getProfile(userId) {
    const profile = state().profiles.get(userId);
    return profile ? clone(profile) : null;
  },
  async upsertProfile(profile) {
    state().profiles.set(profile.userId ?? "", clone(profile));
  },
  async addMemory(userId, record) {
    const s = state();
    const existing = s.memories.find((m) => m.userId === userId && m.kind === record.kind && m.key === record.key);
    if (existing) {
      existing.value = { ...existing.value, ...(record.value ?? {}) };
      existing.text = record.text ?? existing.text;
      existing.importance = Math.max(existing.importance, record.importance ?? 1);
      existing.hits += 1;
      existing.updatedAt = now();
      existing.metadata = { ...existing.metadata, ...(record.metadata ?? {}) };
      return clone(existing);
    }
    const memory: MemoryRecord = {
      id: randomUUID(),
      userId,
      kind: record.kind,
      key: record.key,
      value: record.value ?? {},
      text: record.text,
      importance: record.importance ?? 1,
      hits: 1,
      entityType: record.entityType,
      entityId: record.entityId,
      agentKey: record.agentKey,
      metadata: record.metadata ?? {},
      createdAt: now(),
      updatedAt: now(),
    };
    s.memories.push(memory);
    return clone(memory);
  },
  async listMemories(userId, opts) {
    const limit = opts?.limit ?? 200;
    return clone(
      state()
        .memories.filter((m) => m.userId === userId && (!opts?.kind || m.kind === opts.kind))
        .sort((a, b) => b.importance - a.importance || b.hits - a.hits)
        .slice(0, limit),
    );
  },
  async deleteMemory(userId, kind: MemoryKind, key) {
    const s = state();
    const before = s.memories.length;
    s.memories = s.memories.filter((m) => !(m.userId === userId && m.kind === kind && m.key === key));
    return s.memories.length < before;
  },

  // ---- recommendations ----
  async saveRecommendations(input) {
    const s = state();
    if (input.replace !== false) {
      s.recommendations = s.recommendations.filter(
        (r) => !(r.scenario === input.scenario && ((input.userId && r.userId === input.userId) || (input.sessionId && r.sessionId === input.sessionId))),
      );
    }
    const expiresAt = input.ttlHours ? new Date(Date.now() + input.ttlHours * 3600_000).toISOString() : null;
    for (const item of input.items) {
      s.recommendations.push({
        id: randomUUID(),
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        productId: item.productId,
        vendorId: item.vendorId ?? null,
        scenario: input.scenario,
        score: item.score,
        rank: item.rank,
        reasonCode: item.reasonCode ?? null,
        reasonText: item.reasonText ?? null,
        breakdown: item.breakdown ?? {},
        agentKey: input.agentKey ?? null,
        runId: input.runId ?? null,
        status: "active",
        expiresAt,
        createdAt: now(),
      });
    }
    return input.items.length;
  },
  async listRecommendations(filter) {
    const limit = filter?.limit ?? 24;
    return clone(
      state()
        .recommendations.filter(
          (r) =>
            (filter?.userId === undefined || r.userId === filter.userId) &&
            (filter?.sessionId === undefined || r.sessionId === filter.sessionId) &&
            (!filter?.scenario || r.scenario === filter.scenario) &&
            (!filter?.status || r.status === filter.status),
        )
        .sort((a, b) => a.rank - b.rank || b.score - a.score)
        .slice(0, limit),
    );
  },
  async setRecommendationStatus(id, status) {
    const rec = state().recommendations.find((r) => r.id === id);
    if (rec) rec.status = status;
  },

  // ---- events ----
  async recordEvent(input) {
    const s = state();
    const event: EventRecord = {
      id: randomUUID(),
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      anonymousId: input.anonymousId ?? null,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      path: input.path ?? null,
      metadata: input.metadata ?? {},
      device: input.device ?? null,
      platform: input.platform ?? null,
      processedAt: null,
      createdAt: input.createdAt ?? now(),
    };
    s.events.push(event);
    if (s.events.length > 20_000) s.events.splice(0, s.events.length - 20_000);
    return event.id;
  },
  async listEvents(filter) {
    const limit = filter?.limit ?? 500;
    const sinceMs = filter?.since ? filter.since.getTime() : 0;
    return clone(
      state()
        .events.filter(
          (e) =>
            (filter?.userId === undefined || e.userId === filter.userId) &&
            (filter?.sessionId === undefined || e.sessionId === filter.sessionId) &&
            (!filter?.eventTypes?.length || filter.eventTypes.includes(e.eventType)) &&
            new Date(e.createdAt).getTime() >= sinceMs,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit),
    );
  },
  async markEventsProcessed(ids) {
    const set = new Set(ids);
    for (const event of state().events) if (set.has(event.id)) event.processedAt = now();
  },

  // ---- budgets ----
  async listBudgets() {
    return clone(state().budgets);
  },
  async upsertBudget(input) {
    const scopeKey = input.scope === "global" ? null : input.scopeKey ?? null;
    const record: BudgetRecord = {
      id: `budget-${input.scope}-${scopeKey ?? "global"}`,
      scope: input.scope,
      scopeKey,
      dailyLimitMicro: Math.max(0, Math.round(input.dailyLimitMicro ?? 0)),
      monthlyLimitMicro: Math.max(0, Math.round(input.monthlyLimitMicro ?? 0)),
      perRunLimitMicro: Math.max(0, Math.round(input.perRunLimitMicro ?? 0)),
      maxRunsPerDay: Math.max(0, Math.round(input.maxRunsPerDay ?? 0)),
      isActive: input.isActive !== false,
    };
    const index = state().budgets.findIndex((b) => b.scope === record.scope && (b.scopeKey ?? null) === record.scopeKey);
    if (index >= 0) state().budgets[index] = record;
    else state().budgets.push(record);
    return clone(record);
  },
  async usageSince(scope) {
    const sinceMs = scope.since.getTime();
    const runs = state().agentRuns.filter((r) => {
      if (new Date(r.startedAt).getTime() < sinceMs) return false;
      if (scope.kind === "agent") return r.agentKey === scope.key;
      if (scope.kind === "user") return r.userId === scope.key;
      return true;
    });
    return {
      costMicro: runs.reduce((sum, r) => sum + (r.costMicro ?? 0), 0),
      runs: runs.length,
      tokensIn: runs.reduce((sum, r) => sum + (r.tokensIn ?? 0), 0),
      tokensOut: runs.reduce((sum, r) => sum + (r.tokensOut ?? 0), 0),
    };
  },

  // ---- integrations ----
  async listIntegrations() {
    return clone(state().integrations);
  },
  async updateIntegration(provider, patch) {
    const s = state();
    let integration = s.integrations.find((i) => i.provider === provider);
    if (!integration) {
      integration = {
        id: randomUUID(),
        provider,
        label: provider,
        baseUrl: null,
        secretEnvVar: null,
        authScheme: "bearer",
        config: {},
        capabilities: [],
        isActive: false,
        healthStatus: "unknown",
        lastCheckedAt: null,
      };
      s.integrations.push(integration);
    }
    Object.assign(integration, clone(patch));
    return clone(integration);
  },
};

/** Seed helpers used by the registry bootstrap (shared with the DB adapter). */
export function memoryStoreSeeds() {
  return {
    tools: (tools: ToolRecord[]) => {
      state().tools = clone(tools);
    },
    budgets: (budgets: BudgetRecord[]) => {
      state().budgets = clone(budgets);
    },
    integrations: (integrations: IntegrationRecord[]) => {
      state().integrations = clone(integrations);
    },
  };
}

export type { AgentSchedule, RunStatus };
