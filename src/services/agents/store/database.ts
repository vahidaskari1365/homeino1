// ============================================================
// HOMEINO — DATABASE AGENT STORE (Drizzle + Supabase/Postgres)
//
// Production persistence for the whole agentic core. Every read/write goes
// through the existing Drizzle pool (`@/db`) — no raw SQL, no second client.
// ============================================================
import { and, desc, eq, gte, inArray, isNull, or, sql, type AnyColumn } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Match a row by natural key OR uuid id — the id comparison only when the
 *  input actually is a uuid, otherwise Postgres raises invalid uuid input. */
function keyOrIdWhere(keyCol: AnyColumn, idCol: AnyColumn, keyOrId: string) {
  return UUID_RE.test(keyOrId) ? or(eq(keyCol, keyOrId), eq(idCol, keyOrId)) : eq(keyCol, keyOrId);
}
import { getDb } from "@/db";
import {
  agentApprovals,
  agentBudgets,
  agentPermissions,
  agentRuns,
  agentTaskLogs,
  agentTasks,
  agentToolGrants,
  agentTools,
  agents,
  analyticsEvents,
  customerMemories,
  customerProfiles,
  entityEmbeddings,
  integrationConnections,
  products,
  recommendations,
  workflowEdges,
  workflowNodes,
  workflowRuns,
  workflowRunSteps,
  workflows,
} from "@/db/schema";
import type {
  AgentDefinition,
  AgentSchedule,
  AgentType,
  CustomerProfileSnapshot,
  MemoryKind,
  MemoryRecord,
  RunStatus,
  StepRecord,
  WorkflowDefinition,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition,
  WorkflowNodeType,
} from "../types";
import { normalizePermissions, type AgentPermissionKey } from "../permissions";
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

type AgentRow = typeof agents.$inferSelect;
type WorkflowRow = typeof workflows.$inferSelect;
type RunRow = typeof workflowRuns.$inferSelect;
type AgentRunRow = typeof agentRuns.$inferSelect;
type TaskRow = typeof agentTasks.$inferSelect;
type ApprovalRow = typeof agentApprovals.$inferSelect;
type RecommendationRow = typeof recommendations.$inferSelect;
type EventRow = typeof analyticsEvents.$inferSelect;
type ProfileRow = typeof customerProfiles.$inferSelect;
type MemoryRow = typeof customerMemories.$inferSelect;

const iso = (value: Date | string | null | undefined) =>
  value === null || value === undefined ? null : value instanceof Date ? value.toISOString() : value;
const date = (value: string | null | undefined) => (value ? new Date(value) : null);
const json = <T>(value: unknown, fallback: T): T =>
  value === null || value === undefined ? fallback : (value as T);

// ------------------------------------------------------------
// Row → record mappers
// ------------------------------------------------------------
function toAgent(row: AgentRow, tools: string[], permissions: AgentPermissionKey[]): AgentDefinition {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    type: row.type as AgentType,
    status: row.status,
    model: row.model ?? undefined,
    runtime: (row.runtime ?? "local") as AgentDefinition["runtime"],
    systemPrompt: row.systemPrompt ?? undefined,
    handler: row.handler ?? undefined,
    config: json<Record<string, unknown>>(row.config, {}),
    schedule: (row.schedule as AgentSchedule | null) ?? null,
    maxRetries: row.maxRetries,
    timeoutMs: row.timeoutMs,
    maxCostMicro: row.maxCostMicro,
    tools,
    permissions,
    isBuiltin: row.isBuiltin,
    createdAt: iso(row.createdAt) ?? undefined,
    updatedAt: iso(row.updatedAt) ?? undefined,
  };
}

function toRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    workflowId: row.workflowId,
    workflowKey: row.workflowKey,
    status: row.status as RunStatus,
    triggerKind: row.triggerKind,
    triggerPayload: json<Record<string, unknown>>(row.triggerPayload, {}),
    input: json<Record<string, unknown>>(row.input, {}),
    output: (row.output as Record<string, unknown> | null) ?? null,
    userId: row.userId,
    sessionId: row.sessionId,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    error: row.error,
    errorCode: row.errorCode,
    toolsUsed: json<string[]>(row.toolsUsed, []),
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costMicro: row.costMicro,
    model: row.model,
    provider: row.provider,
    startedAt: iso(row.startedAt) ?? new Date().toISOString(),
    finishedAt: iso(row.finishedAt),
    durationMs: row.durationMs,
  };
}

function toAgentRun(row: AgentRunRow): AgentRunRecord {
  return {
    id: row.id,
    agentKey: row.agentKey,
    agentId: row.agentId,
    runId: row.runId,
    taskId: row.taskId,
    userId: row.userId,
    status: row.status as RunStatus,
    input: json<Record<string, unknown>>(row.input, {}),
    output: (row.output as Record<string, unknown> | null) ?? null,
    toolsUsed: json<string[]>(row.toolsUsed, []),
    provider: row.provider,
    model: row.model,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costMicro: row.costMicro,
    durationMs: row.durationMs,
    attempt: row.attempt,
    error: row.error,
    errorCode: row.errorCode,
    startedAt: iso(row.startedAt) ?? new Date().toISOString(),
    finishedAt: iso(row.finishedAt),
  };
}

function toTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority,
    agentKey: row.agentKey,
    workflowRunId: row.workflowRunId,
    userId: row.userId,
    vendorId: row.vendorId,
    productId: row.productId,
    payload: json<Record<string, unknown>>(row.payload, {}),
    result: (row.result as Record<string, unknown> | null) ?? null,
    error: row.error,
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    assigneeRole: row.assigneeRole,
    dueAt: iso(row.dueAt),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toApproval(row: ApprovalRow): ApprovalRecord {
  return {
    id: row.id,
    agentKey: row.agentKey,
    taskId: row.taskId,
    runId: row.runId,
    action: row.action,
    reason: row.reason,
    riskLevel: row.riskLevel,
    payload: json<Record<string, unknown>>(row.payload, {}),
    status: row.status,
    requestedBy: row.requestedBy,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
    expiresAt: iso(row.expiresAt),
    decidedAt: iso(row.decidedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toRecommendation(row: RecommendationRow): RecommendationRecord {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    productId: row.productId,
    vendorId: row.vendorId,
    scenario: row.scenario,
    score: row.score,
    rank: row.rank,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    breakdown: json<Record<string, number>>(row.breakdown, {}),
    agentKey: row.agentKey,
    runId: row.runId,
    status: row.status,
    expiresAt: iso(row.expiresAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toEvent(row: EventRow): EventRecord {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    anonymousId: row.anonymousId,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    path: row.path,
    metadata: json<Record<string, unknown>>(row.metadata, {}),
    device: row.device,
    platform: row.platform,
    processedAt: iso(row.processedAt),
    createdAt: iso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind as MemoryKind,
    key: row.memoryKey,
    value: json<Record<string, unknown>>(row.value, {}),
    text: row.text ?? undefined,
    importance: row.importance,
    hits: row.hits,
    entityType: row.entityType ?? undefined,
    entityId: row.entityId ?? undefined,
    agentKey: row.agentKey ?? undefined,
    metadata: json<Record<string, unknown>>(row.metadata, {}),
    createdAt: iso(row.createdAt) ?? undefined,
    updatedAt: iso(row.updatedAt) ?? undefined,
  };
}

function toProfile(row: ProfileRow, eventCount?: number): CustomerProfileSnapshot {
  const priceMin = row.preferredPriceMin ?? undefined;
  const priceMax = row.preferredPriceMax ?? undefined;
  return {
    userId: row.userId,
    preferredStyles: json<string[]>(row.preferredStyles, []),
    preferredColors: json<string[]>(row.preferredColors, []),
    preferredCategories: json<string[]>(row.preferredCategories, []),
    preferredMaterials: json<string[]>(row.preferredMaterials, []),
    preferredRooms: json<string[]>(row.preferredRooms, []),
    preferredStores: json<string[]>(row.preferredStores, []),
    preferredPriceRange: { min: priceMin, max: priceMax },
    recentInterests: json<CustomerProfileSnapshot["recentInterests"]>(row.recentInterests, []),
    purchasePatterns: json<CustomerProfileSnapshot["purchasePatterns"]>(row.purchasePatterns, []),
    confidence: (row.confidence ?? 0) / 100,
    eventCount: row.eventCount ?? eventCount ?? 0,
    dataState: row.confidence >= 40 ? "ok" : row.confidence > 0 ? "not_enough_data" : "no_data",
    computedAt: iso(row.lastComputedAt) ?? iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------
export const databaseAgentStore: AgentStore = {
  mode: "database",

  async listAgents() {
    const db = getDb();
    const rows = await db.select().from(agents).orderBy(agents.name);
    const ids = rows.map((r) => r.id);
    const [grants, perms] = ids.length
      ? await Promise.all([
          db.select().from(agentToolGrants).where(inArray(agentToolGrants.agentId, ids)),
          db.select().from(agentPermissions).where(inArray(agentPermissions.agentId, ids)),
        ])
      : [[], []];
    return rows.map((row) =>
      toAgent(
        row,
        grants.filter((g) => g.agentId === row.id).map((g) => g.toolKey),
        normalizePermissions(perms.filter((p) => p.agentId === row.id).map((p) => p.permission)),
      ),
    );
  },

  async getAgent(keyOrId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(agents)
      .where(keyOrIdWhere(agents.key, agents.id, keyOrId))
      .limit(1);
    if (!row) return null;
    const [grants, perms] = await Promise.all([
      db.select().from(agentToolGrants).where(eq(agentToolGrants.agentId, row.id)),
      db.select().from(agentPermissions).where(eq(agentPermissions.agentId, row.id)),
    ]);
    return toAgent(row, grants.map((g) => g.toolKey), normalizePermissions(perms.map((p) => p.permission)));
  },

  async createAgent(input: NewAgentInput) {
    const db = getDb();
    const [row] = await db
      .insert(agents)
      .values({
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        status: input.status ?? "draft",
        model: input.model ?? null,
        runtime: input.runtime ?? "local",
        systemPrompt: input.systemPrompt ?? null,
        handler: input.handler ?? null,
        config: input.config ?? {},
        schedule: (input.schedule ?? null) as Record<string, unknown> | null,
        maxRetries: input.maxRetries ?? 2,
        timeoutMs: input.timeoutMs ?? 30000,
        maxCostMicro: input.maxCostMicro ?? 0,
        isBuiltin: input.isBuiltin ?? false,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    await syncAgentGrants(row.id, input.tools ?? [], input.permissions ?? []);
    return (await this.getAgent(row.key))!;
  },

  async updateAgent(keyOrId, patch: AgentPatch) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(agents)
      .where(keyOrIdWhere(agents.key, agents.id, keyOrId))
      .limit(1);
    if (!row) return null;
    const values: Partial<typeof agents.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.description !== undefined) values.description = patch.description ?? null;
    if (patch.type !== undefined) values.type = patch.type;
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.model !== undefined) values.model = patch.model ?? null;
    if (patch.runtime !== undefined) values.runtime = patch.runtime;
    if (patch.systemPrompt !== undefined) values.systemPrompt = patch.systemPrompt ?? null;
    if (patch.handler !== undefined) values.handler = patch.handler ?? null;
    if (patch.config !== undefined) values.config = patch.config;
    if (patch.schedule !== undefined) values.schedule = (patch.schedule ?? null) as Record<string, unknown> | null;
    if (patch.maxRetries !== undefined) values.maxRetries = patch.maxRetries;
    if (patch.timeoutMs !== undefined) values.timeoutMs = patch.timeoutMs;
    if (patch.maxCostMicro !== undefined) values.maxCostMicro = patch.maxCostMicro;
    await db.update(agents).set(values).where(eq(agents.id, row.id));
    if (patch.tools || patch.permissions) {
      await syncAgentGrants(row.id, patch.tools ?? null, patch.permissions ?? null);
    }
    return this.getAgent(row.key);
  },

  async deleteAgent(keyOrId) {
    const db = getDb();
    const [row] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(keyOrIdWhere(agents.key, agents.id, keyOrId))
      .limit(1);
    if (!row) return false;
    // Built-in agents are archived, never deleted — history stays intact.
    const [full] = await db.select().from(agents).where(eq(agents.id, row.id)).limit(1);
    if (full?.isBuiltin) {
      await db.update(agents).set({ status: "archived", updatedAt: new Date() }).where(eq(agents.id, row.id));
      return true;
    }
    await db.delete(agents).where(eq(agents.id, row.id));
    return true;
  },

  async listTools() {
    const db = getDb();
    const rows = await db.select().from(agentTools).orderBy(agentTools.category, agentTools.key);
    return rows.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description ?? "",
      category: r.category,
      requiredPermission: r.requiredPermission as AgentPermissionKey,
      requiresApproval: r.requiresApproval,
      isDestructive: r.isDestructive,
      inputSchema: json<Record<string, string>>(r.inputSchema, {}),
      isActive: r.isActive,
      isBuiltin: r.isBuiltin,
    }));
  },

  async listWorkflows() {
    const db = getDb();
    const rows = await db.select().from(workflows).orderBy(workflows.name);
    const ids = rows.map((r) => r.id);
    const [nodeRows, edgeRows] = ids.length
      ? await Promise.all([
          db.select().from(workflowNodes).where(inArray(workflowNodes.workflowId, ids)).orderBy(workflowNodes.orderIndex),
          db.select().from(workflowEdges).where(inArray(workflowEdges.workflowId, ids)).orderBy(workflowEdges.orderIndex),
        ])
      : [[], []];
    return rows.map((row) => toWorkflow(row, nodeRows.filter((n) => n.workflowId === row.id), edgeRows.filter((e) => e.workflowId === row.id)));
  },

  async getWorkflow(keyOrId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(workflows)
      .where(keyOrIdWhere(workflows.key, workflows.id, keyOrId))
      .limit(1);
    if (!row) return null;
    const [nodeRows, edgeRows] = await Promise.all([
      db.select().from(workflowNodes).where(eq(workflowNodes.workflowId, row.id)).orderBy(workflowNodes.orderIndex),
      db.select().from(workflowEdges).where(eq(workflowEdges.workflowId, row.id)).orderBy(workflowEdges.orderIndex),
    ]);
    return toWorkflow(row, nodeRows, edgeRows);
  },

  async createWorkflow(input: NewWorkflowInput) {
    const db = getDb();
    const [row] = await db
      .insert(workflows)
      .values({
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "draft",
        runtime: input.runtime ?? "local",
        version: 1,
        triggerKind: input.triggerKind ?? "manual",
        trigger: (input.trigger ?? {}) as Record<string, unknown>,
        schedule: (input.schedule ?? null) as Record<string, unknown> | null,
        config: input.config ?? {},
        isBuiltin: input.isBuiltin ?? false,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    await writeGraph(row.id, input.nodes, input.edges);
    return (await this.getWorkflow(row.key))!;
  },

  async updateWorkflow(keyOrId, patch: WorkflowPatch) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(workflows)
      .where(keyOrIdWhere(workflows.key, workflows.id, keyOrId))
      .limit(1);
    if (!row) return null;
    const values: Partial<typeof workflows.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.description !== undefined) values.description = patch.description ?? null;
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.runtime !== undefined) values.runtime = patch.runtime ?? "local";
    if (patch.triggerKind !== undefined) values.triggerKind = patch.triggerKind;
    if (patch.trigger !== undefined) values.trigger = patch.trigger as Record<string, unknown>;
    if (patch.schedule !== undefined) values.schedule = (patch.schedule ?? null) as Record<string, unknown> | null;
    if (patch.config !== undefined) values.config = patch.config;
    if (patch.lastRunAt !== undefined) values.lastRunAt = date(patch.lastRunAt);
    if (patch.nextRunAt !== undefined) values.nextRunAt = date(patch.nextRunAt);
    if (patch.nodes || patch.edges) values.version = row.version + 1;
    await db.update(workflows).set(values).where(eq(workflows.id, row.id));
    if (patch.nodes && patch.edges) await writeGraph(row.id, patch.nodes, patch.edges);
    return this.getWorkflow(row.key);
  },

  async deleteWorkflow(keyOrId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(workflows)
      .where(keyOrIdWhere(workflows.key, workflows.id, keyOrId))
      .limit(1);
    if (!row) return false;
    if (row.isBuiltin) {
      await db.update(workflows).set({ status: "archived", updatedAt: new Date() }).where(eq(workflows.id, row.id));
      return true;
    }
    await db.delete(workflows).where(eq(workflows.id, row.id));
    return true;
  },

  async createRun(input) {
    const db = getDb();
    const [row] = await db
      .insert(workflowRuns)
      .values({
        workflowId: input.workflowId ?? null,
        workflowKey: input.workflowKey ?? null,
        status: input.status ?? "queued",
        triggerKind: input.triggerKind,
        triggerPayload: input.triggerPayload ?? {},
        input: input.input ?? {},
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        maxAttempts: input.maxAttempts ?? 1,
      })
      .returning();
    return row.id;
  },

  async updateRun(id, patch) {
    const db = getDb();
    const values: Partial<typeof workflowRuns.$inferInsert> = {};
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.output !== undefined) values.output = (patch.output ?? null) as Record<string, unknown> | null;
    if (patch.error !== undefined) values.error = patch.error ?? null;
    if (patch.errorCode !== undefined) values.errorCode = patch.errorCode ?? null;
    if (patch.toolsUsed !== undefined) values.toolsUsed = patch.toolsUsed;
    if (patch.tokensIn !== undefined) values.tokensIn = patch.tokensIn;
    if (patch.tokensOut !== undefined) values.tokensOut = patch.tokensOut;
    if (patch.costMicro !== undefined) values.costMicro = patch.costMicro;
    if (patch.model !== undefined) values.model = patch.model ?? null;
    if (patch.provider !== undefined) values.provider = patch.provider ?? null;
    if (patch.attempt !== undefined) values.attempt = patch.attempt;
    if (patch.durationMs !== undefined) values.durationMs = patch.durationMs ?? null;
    if (patch.finishedAt !== undefined) values.finishedAt = date(patch.finishedAt);
    if (Object.keys(values).length) await db.update(workflowRuns).set(values).where(eq(workflowRuns.id, id));
  },

  async getRun(id) {
    const db = getDb();
    const [row] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).limit(1);
    return row ? toRun(row) : null;
  },

  async listRuns(filter) {
    const db = getDb();
    const limit = Math.min(filter?.limit ?? 50, 200);
    const conds = [];
    if (filter?.workflowKey) conds.push(eq(workflowRuns.workflowKey, filter.workflowKey));
    if (filter?.status) conds.push(eq(workflowRuns.status, filter.status));
    const rows = await db
      .select()
      .from(workflowRuns)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(workflowRuns.startedAt))
      .limit(limit);
    return rows.map(toRun);
  },

  async addStep(runId, step) {
    const db = getDb();
    await db.insert(workflowRunSteps).values({
      runId,
      nodeKey: step.nodeKey,
      nodeType: step.nodeType,
      label: step.label ?? null,
      agentKey: step.agentKey ?? null,
      status: step.status as never,
      attempt: step.attempt,
      input: (step.input ?? null) as Record<string, unknown> | null,
      output: (step.output ?? null) as Record<string, unknown> | null,
      error: step.error ?? null,
      tokensIn: step.tokensIn,
      tokensOut: step.tokensOut,
      costMicro: step.costMicro,
      startedAt: date(step.startedAt) ?? new Date(),
      finishedAt: date(step.finishedAt),
      durationMs: step.durationMs ?? null,
    });
  },

  async listSteps(runId) {
    const db = getDb();
    const rows = await db.select().from(workflowRunSteps).where(eq(workflowRunSteps.runId, runId)).orderBy(workflowRunSteps.startedAt);
    return rows.map((r) => ({
      nodeKey: r.nodeKey,
      nodeType: r.nodeType as WorkflowNodeType,
      label: r.label ?? undefined,
      agentKey: r.agentKey ?? undefined,
      status: r.status as StepRecord["status"],
      attempt: r.attempt,
      input: (r.input as Record<string, unknown> | null) ?? undefined,
      output: (r.output as Record<string, unknown> | null) ?? undefined,
      error: r.error ?? undefined,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      costMicro: r.costMicro,
      startedAt: iso(r.startedAt) ?? new Date().toISOString(),
      finishedAt: iso(r.finishedAt) ?? undefined,
      durationMs: r.durationMs ?? undefined,
    }));
  },

  async logAgentRun(record) {
    const db = getDb();
    const [row] = await db
      .insert(agentRuns)
      .values({
        agentKey: record.agentKey,
        agentId: record.agentId ?? null,
        runId: record.runId ?? null,
        taskId: record.taskId ?? null,
        userId: record.userId ?? null,
        status: record.status,
        input: record.input ?? {},
        output: (record.output ?? null) as Record<string, unknown> | null,
        toolsUsed: record.toolsUsed ?? [],
        provider: record.provider ?? null,
        model: record.model ?? null,
        tokensIn: record.tokensIn ?? 0,
        tokensOut: record.tokensOut ?? 0,
        costMicro: record.costMicro ?? 0,
        durationMs: record.durationMs ?? null,
        attempt: record.attempt ?? 1,
        error: record.error ?? null,
        errorCode: record.errorCode ?? null,
        startedAt: date(record.startedAt) ?? new Date(),
        finishedAt: date(record.finishedAt),
      })
      .returning();
    return row.id;
  },

  async listAgentRuns(filter) {
    const db = getDb();
    const limit = Math.min(filter?.limit ?? 50, 200);
    const conds = [];
    if (filter?.agentKey) conds.push(eq(agentRuns.agentKey, filter.agentKey));
    if (filter?.runId) conds.push(eq(agentRuns.runId, filter.runId));
    if (filter?.status) conds.push(eq(agentRuns.status, filter.status));
    const rows = await db
      .select()
      .from(agentRuns)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);
    return rows.map(toAgentRun);
  },

  async createTask(input) {
    const db = getDb();
    const [row] = await db
      .insert(agentTasks)
      .values({
        title: input.title.slice(0, 200),
        type: input.type ?? "generic",
        status: input.status ?? "pending",
        priority: input.priority ?? 0,
        agentKey: input.agentKey ?? null,
        workflowRunId: input.workflowRunId ?? null,
        userId: input.userId ?? null,
        vendorId: uuidOrNull(input.vendorId),
        productId: uuidOrNull(input.productId),
        payload: input.payload ?? {},
        maxAttempts: input.maxAttempts ?? 3,
        assigneeRole: input.assigneeRole ?? "admin",
        dueAt: date(input.dueAt),
      })
      .returning();
    return row.id;
  },

  async getTask(id) {
    const db = getDb();
    const [row] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);
    return row ? toTask(row) : null;
  },

  async listTasks(filter) {
    const db = getDb();
    const limit = Math.min(filter?.limit ?? 100, 200);
    const conds = [];
    if (filter?.status) conds.push(eq(agentTasks.status, filter.status));
    if (filter?.agentKey) conds.push(eq(agentTasks.agentKey, filter.agentKey));
    const rows = await db
      .select()
      .from(agentTasks)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(agentTasks.priority), desc(agentTasks.createdAt))
      .limit(limit);
    return rows.map(toTask);
  },

  async updateTask(id, patch) {
    const db = getDb();
    const values: Partial<typeof agentTasks.$inferInsert> = { updatedAt: new Date() };
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.result !== undefined) values.result = (patch.result ?? null) as Record<string, unknown> | null;
    if (patch.error !== undefined) values.error = patch.error ?? null;
    if (patch.attempt !== undefined) values.attempt = patch.attempt;
    if (patch.startedAt !== undefined) values.startedAt = date(patch.startedAt);
    if (patch.completedAt !== undefined) values.completedAt = date(patch.completedAt);
    if (patch.payload !== undefined) values.payload = patch.payload;
    if (patch.priority !== undefined) values.priority = patch.priority;
    await db.update(agentTasks).set(values).where(eq(agentTasks.id, id));
  },

  async addTaskLog(taskId, level, message, meta) {
    const db = getDb();
    await db.insert(agentTaskLogs).values({ taskId, level, message, meta: meta ?? {} });
  },

  async listTaskLogs(taskId) {
    const db = getDb();
    const rows = await db.select().from(agentTaskLogs).where(eq(agentTaskLogs.taskId, taskId)).orderBy(agentTaskLogs.createdAt);
    return rows.map(
      (r): TaskLogRecord => ({
        id: r.id,
        taskId: r.taskId,
        level: r.level,
        message: r.message,
        meta: json<Record<string, unknown>>(r.meta, {}),
        createdAt: iso(r.createdAt) ?? new Date().toISOString(),
      }),
    );
  },

  async createApproval(input) {
    const db = getDb();
    const [row] = await db
      .insert(agentApprovals)
      .values({
        agentKey: input.agentKey ?? null,
        taskId: uuidOrNull(input.taskId),
        runId: uuidOrNull(input.runId),
        action: input.action.slice(0, 120),
        reason: input.reason ?? null,
        riskLevel: input.riskLevel,
        payload: input.payload ?? {},
        expiresAt: date(input.expiresAt),
      })
      .returning();
    return row.id;
  },

  async listApprovals(filter) {
    const db = getDb();
    const limit = Math.min(filter?.limit ?? 100, 200);
    const rows = await db
      .select()
      .from(agentApprovals)
      .where(filter?.status ? eq(agentApprovals.status, filter.status) : undefined)
      .orderBy(desc(agentApprovals.createdAt))
      .limit(limit);
    return rows.map(toApproval);
  },

  async getApproval(id) {
    const db = getDb();
    const [row] = await db.select().from(agentApprovals).where(eq(agentApprovals.id, id)).limit(1);
    return row ? toApproval(row) : null;
  },

  async decideApproval(id, decision, decidedBy, note) {
    const db = getDb();
    const [row] = await db
      .update(agentApprovals)
      .set({ status: decision, decidedBy: uuidOrNull(decidedBy), decisionNote: note ?? null, decidedAt: new Date() })
      .where(and(eq(agentApprovals.id, id), eq(agentApprovals.status, "pending")))
      .returning();
    return row ? toApproval(row) : null;
  },

  async expireApproval(id) {
    const db = getDb();
    const [row] = await db
      .update(agentApprovals)
      .set({ status: "expired", decisionNote: "منقضی شد", decidedAt: new Date() })
      .where(and(eq(agentApprovals.id, id), eq(agentApprovals.status, "pending")))
      .returning();
    return row ? toApproval(row) : null;
  },

  async getProfile(userId) {
    const db = getDb();
    const [row] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
    return row ? toProfile(row) : null;
  },

  async upsertProfile(profile) {
    if (!profile.userId) return;
    const db = getDb();
    const values = {
      preferredStyles: profile.preferredStyles,
      preferredColors: profile.preferredColors,
      preferredCategories: profile.preferredCategories,
      preferredMaterials: profile.preferredMaterials,
      preferredRooms: profile.preferredRooms,
      preferredStores: profile.preferredStores,
      preferredPriceMin: profile.preferredPriceRange.min ?? null,
      preferredPriceMax: profile.preferredPriceRange.max ?? null,
      recentInterests: profile.recentInterests as Record<string, unknown>[],
      purchasePatterns: profile.purchasePatterns as Record<string, unknown>[],
      confidence: Math.round(Math.min(1, Math.max(0, profile.confidence)) * 100),
      eventCount: profile.eventCount,
      source: "agent",
      lastComputedAt: new Date(),
      updatedAt: new Date(),
    };
    await db
      .insert(customerProfiles)
      .values({ userId: profile.userId, ...values })
      .onConflictDoUpdate({ target: customerProfiles.userId, set: values });
  },

  async addMemory(userId, record) {
    const db = getDb();
    const values = {
      value: record.value ?? {},
      text: record.text ?? null,
      importance: record.importance ?? 1,
      entityType: record.entityType ?? null,
      entityId: record.entityId ?? null,
      agentKey: record.agentKey ?? null,
      metadata: record.metadata ?? {},
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(customerMemories)
      .values({ userId, kind: record.kind, memoryKey: record.key.slice(0, 160), hits: 1, ...values })
      .onConflictDoUpdate({
        target: [customerMemories.userId, customerMemories.kind, customerMemories.memoryKey],
        set: { ...values, hits: sql`${customerMemories.hits} + 1` },
      })
      .returning();
    return row ? toMemory(row) : null;
  },

  async listMemories(userId, opts) {
    const db = getDb();
    const limit = Math.min(opts?.limit ?? 200, 500);
    const rows = await db
      .select()
      .from(customerMemories)
      .where(and(eq(customerMemories.userId, userId), opts?.kind ? eq(customerMemories.kind, opts.kind) : undefined))
      .orderBy(desc(customerMemories.importance), desc(customerMemories.hits))
      .limit(limit);
    return rows.map(toMemory);
  },

  async deleteMemory(userId, kind, key) {
    const db = getDb();
    const rows = await db
      .delete(customerMemories)
      .where(and(eq(customerMemories.userId, userId), eq(customerMemories.kind, kind), eq(customerMemories.memoryKey, key)))
      .returning({ id: customerMemories.id });
    return rows.length > 0;
  },

  async saveRecommendations(input) {
    const db = getDb();
    if (!input.items.length) return 0;

    // Integrity gate: only ids that exist in the real catalog are persisted.
    const ids = [...new Set(input.items.map((i) => i.productId))].filter((id) => UUID_RE.test(id));
    if (!ids.length) return 0;
    const existing = await db.select({ id: products.id, vendorId: products.vendorId }).from(products).where(inArray(products.id, ids));
    const known = new Map(existing.map((p) => [p.id, p.vendorId]));

    if (input.replace !== false) {
      const scopeConds = [eq(recommendations.scenario, input.scenario)];
      if (input.userId) scopeConds.push(eq(recommendations.userId, input.userId));
      else if (input.sessionId) scopeConds.push(eq(recommendations.sessionId, input.sessionId));
      await db.delete(recommendations).where(and(...scopeConds));
    }

    const expiresAt = input.ttlHours ? new Date(Date.now() + input.ttlHours * 3600_000) : null;
    const rows = input.items
      .filter((item) => known.has(item.productId))
      .map((item) => ({
        userId: uuidOrNull(input.userId),
        sessionId: input.sessionId ?? null,
        productId: item.productId,
        vendorId: uuidOrNull(item.vendorId) ?? uuidOrNull(known.get(item.productId) ?? null),
        scenario: input.scenario.slice(0, 60),
        score: item.score,
        rank: item.rank,
        reasonCode: item.reasonCode ?? null,
        reasonText: item.reasonText?.slice(0, 240) ?? null,
        breakdown: item.breakdown ?? {},
        agentKey: input.agentKey ?? null,
        runId: uuidOrNull(input.runId),
        contextSnapshot: input.contextSnapshot ?? {},
        expiresAt,
      }));
    if (!rows.length) return 0;
    await db.insert(recommendations).values(rows);
    return rows.length;
  },

  async listRecommendations(filter) {
    const db = getDb();
    const limit = Math.min(filter?.limit ?? 24, 100);
    const conds = [
      // A recommendation is only returned while its product row still exists.
      inArray(
        recommendations.productId,
        db.select({ id: products.id }).from(products).where(isNull(products.deletedAt)),
      ),
    ];
    if (filter?.userId !== undefined) {
      const uid = uuidOrNull(filter.userId);
      conds.push(uid ? eq(recommendations.userId, uid) : isNull(recommendations.userId));
    }
    if (filter?.sessionId !== undefined) {
      conds.push(filter.sessionId ? eq(recommendations.sessionId, filter.sessionId) : isNull(recommendations.sessionId));
    }
    if (filter?.scenario) conds.push(eq(recommendations.scenario, filter.scenario));
    if (filter?.status) conds.push(eq(recommendations.status, filter.status));
    const rows = await db
      .select()
      .from(recommendations)
      .where(and(...conds))
      .orderBy(recommendations.rank, desc(recommendations.score))
      .limit(limit);
    return rows.map(toRecommendation);
  },

  async setRecommendationStatus(id, status) {
    const db = getDb();
    await db.update(recommendations).set({ status }).where(eq(recommendations.id, id));
  },

  async recordEvent(input) {
    const db = getDb();
    const [row] = await db
      .insert(analyticsEvents)
      .values({
        userId: uuidOrNull(input.userId),
        sessionId: input.sessionId ?? null,
        anonymousId: input.anonymousId ?? null,
        eventType: input.eventType.slice(0, 60),
        entityType: input.entityType ?? null,
        entityId: input.entityId?.slice(0, 120) ?? null,
        path: input.path?.slice(0, 300) ?? null,
        metadata: input.metadata ?? {},
        device: input.device ?? null,
        platform: input.platform ?? null,
        createdAt: date(input.createdAt) ?? new Date(),
      })
      .returning();
    return row.id;
  },

  async listEvents(filter) {
    const db = getDb();
    const limit = Math.min(filter?.limit ?? 500, 2000);
    const conds = [];
    if (filter?.userId !== undefined) {
      const uid = uuidOrNull(filter.userId);
      conds.push(uid ? eq(analyticsEvents.userId, uid) : isNull(analyticsEvents.userId));
    }
    if (filter?.sessionId !== undefined) {
      conds.push(filter.sessionId ? eq(analyticsEvents.sessionId, filter.sessionId) : isNull(analyticsEvents.sessionId));
    }
    if (filter?.eventTypes?.length) conds.push(inArray(analyticsEvents.eventType, filter.eventTypes));
    if (filter?.since) conds.push(gte(analyticsEvents.createdAt, filter.since));
    const rows = await db
      .select()
      .from(analyticsEvents)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(limit);
    return rows.map(toEvent);
  },

  async markEventsProcessed(ids) {
    if (!ids.length) return;
    const db = getDb();
    await db.update(analyticsEvents).set({ processedAt: new Date() }).where(inArray(analyticsEvents.id, ids.slice(0, 5000)));
  },

  async listBudgets() {
    const db = getDb();
    const rows = await db.select().from(agentBudgets);
    return rows.map(
      (r): BudgetRecord => ({
        id: r.id,
        scope: r.scope,
        scopeKey: r.scopeKey,
        dailyLimitMicro: r.dailyLimitMicro,
        monthlyLimitMicro: r.monthlyLimitMicro,
        perRunLimitMicro: r.perRunLimitMicro,
        maxRunsPerDay: r.maxRunsPerDay,
        isActive: r.isActive,
      }),
    );
  },

  async upsertBudget(input) {
    const db = getDb();
    const values = {
      scope: input.scope,
      scopeKey: input.scope === "global" ? null : input.scopeKey ?? null,
      dailyLimitMicro: Math.max(0, Math.round(input.dailyLimitMicro ?? 0)),
      monthlyLimitMicro: Math.max(0, Math.round(input.monthlyLimitMicro ?? 0)),
      perRunLimitMicro: Math.max(0, Math.round(input.perRunLimitMicro ?? 0)),
      maxRunsPerDay: Math.max(0, Math.round(input.maxRunsPerDay ?? 0)),
      isActive: input.isActive !== false,
    };
    const [row] = await db
      .insert(agentBudgets)
      .values(values)
      .onConflictDoUpdate({
        target: [agentBudgets.scope, agentBudgets.scopeKey],
        set: {
          dailyLimitMicro: values.dailyLimitMicro,
          monthlyLimitMicro: values.monthlyLimitMicro,
          perRunLimitMicro: values.perRunLimitMicro,
          maxRunsPerDay: values.maxRunsPerDay,
          isActive: values.isActive,
        },
      })
      .returning();
    return row
      ? {
          id: row.id,
          scope: row.scope,
          scopeKey: row.scopeKey,
          dailyLimitMicro: row.dailyLimitMicro,
          monthlyLimitMicro: row.monthlyLimitMicro,
          perRunLimitMicro: row.perRunLimitMicro,
          maxRunsPerDay: row.maxRunsPerDay,
          isActive: row.isActive,
        }
      : null;
  },

  async usageSince(scope) {
    const db = getDb();
    const conds = [gte(agentRuns.startedAt, scope.since)];
    if (scope.kind === "agent" && scope.key) conds.push(eq(agentRuns.agentKey, scope.key));
    if (scope.kind === "user" && scope.key) {
      const uid = uuidOrNull(scope.key);
      if (uid) conds.push(eq(agentRuns.userId, uid));
    }
    if (scope.kind === "workflow" && scope.key) {
      conds.push(
        inArray(
          agentRuns.runId,
          db.select({ id: workflowRuns.id }).from(workflowRuns).where(eq(workflowRuns.workflowKey, scope.key)),
        ),
      );
    }
    const [row] = await db
      .select({
        costMicro: sql<number>`coalesce(sum(${agentRuns.costMicro}), 0)::int`,
        runs: sql<number>`count(*)::int`,
        tokensIn: sql<number>`coalesce(sum(${agentRuns.tokensIn}), 0)::int`,
        tokensOut: sql<number>`coalesce(sum(${agentRuns.tokensOut}), 0)::int`,
      })
      .from(agentRuns)
      .where(and(...conds));
    return {
      costMicro: Number(row?.costMicro ?? 0),
      runs: Number(row?.runs ?? 0),
      tokensIn: Number(row?.tokensIn ?? 0),
      tokensOut: Number(row?.tokensOut ?? 0),
    };
  },

  async listIntegrations() {
    const db = getDb();
    const rows = await db.select().from(integrationConnections).orderBy(integrationConnections.provider);
    return rows.map(
      (r): IntegrationRecord => ({
        id: r.id,
        provider: r.provider,
        label: r.label,
        baseUrl: r.baseUrl,
        secretEnvVar: r.secretEnvVar,
        authScheme: r.authScheme,
        config: json<Record<string, unknown>>(r.config, {}),
        capabilities: json<string[]>(r.capabilities, []),
        isActive: r.isActive,
        healthStatus: r.healthStatus,
        lastCheckedAt: iso(r.lastCheckedAt),
      }),
    );
  },

  async updateIntegration(provider, patch) {
    const db = getDb();
    const values: Partial<typeof integrationConnections.$inferInsert> = { updatedAt: new Date() };
    if (patch.baseUrl !== undefined) values.baseUrl = patch.baseUrl ?? null;
    if (patch.label !== undefined) values.label = patch.label;
    if (patch.secretEnvVar !== undefined) values.secretEnvVar = patch.secretEnvVar ?? null;
    if (patch.isActive !== undefined) values.isActive = patch.isActive;
    if (patch.config !== undefined) values.config = patch.config;
    if (patch.capabilities !== undefined) values.capabilities = patch.capabilities;
    if (patch.healthStatus !== undefined) {
      values.healthStatus = patch.healthStatus;
      values.lastCheckedAt = new Date();
    }
    const [row] = await db
      .update(integrationConnections)
      .set(values)
      .where(eq(integrationConnections.provider, provider))
      .returning();
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      label: row.label,
      baseUrl: row.baseUrl,
      secretEnvVar: row.secretEnvVar,
      authScheme: row.authScheme,
      config: json<Record<string, unknown>>(row.config, {}),
      capabilities: json<string[]>(row.capabilities, []),
      isActive: row.isActive,
      healthStatus: row.healthStatus,
      lastCheckedAt: iso(row.lastCheckedAt),
    };
  },
};

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
/** Only real uuids may reach a uuid column — anything else becomes NULL. */
function uuidOrNull(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

function toWorkflow(
  row: WorkflowRow,
  nodeRows: (typeof workflowNodes.$inferSelect)[],
  edgeRows: (typeof workflowEdges.$inferSelect)[],
): WorkflowDefinition {
  const nodes: WorkflowNodeDefinition[] = nodeRows.map((n) => ({
    key: n.nodeKey,
    type: n.type as WorkflowNodeType,
    label: n.label ?? undefined,
    agentKey: n.agentKey ?? undefined,
    config: json<Record<string, unknown>>(n.config, {}),
    position: json<{ x: number; y: number }>(n.position, { x: 0, y: 0 }),
  }));
  const edges: WorkflowEdgeDefinition[] = edgeRows.map((e) => ({
    from: e.fromNode,
    to: e.toNode,
    label: e.conditionLabel ?? null,
  }));
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    runtime: (row.runtime as WorkflowDefinition["runtime"]) ?? "local",
    version: row.version,
    triggerKind: row.triggerKind,
    trigger: json<WorkflowDefinition["trigger"]>(row.trigger, {}),
    schedule: (row.schedule as AgentSchedule | null) ?? null,
    config: json<Record<string, unknown>>(row.config, {}),
    nodes,
    edges,
    isBuiltin: row.isBuiltin,
    lastRunAt: iso(row.lastRunAt),
    nextRunAt: iso(row.nextRunAt),
    createdAt: iso(row.createdAt) ?? undefined,
    updatedAt: iso(row.updatedAt) ?? undefined,
  };
}

async function writeGraph(workflowId: string, nodes: WorkflowNodeDefinition[], edges: WorkflowEdgeDefinition[]) {
  const db = getDb();
  await db.delete(workflowEdges).where(eq(workflowEdges.workflowId, workflowId));
  await db.delete(workflowNodes).where(eq(workflowNodes.workflowId, workflowId));
  if (nodes.length) {
    await db.insert(workflowNodes).values(
      nodes.map((n, i) => ({
        workflowId,
        nodeKey: n.key.slice(0, 40),
        type: n.type,
        label: n.label?.slice(0, 160) ?? null,
        agentKey: n.agentKey ?? null,
        config: n.config ?? {},
        position: n.position ?? { x: 0, y: i * 96 },
        orderIndex: i,
      })),
    );
  }
  if (edges.length) {
    await db.insert(workflowEdges).values(
      edges.map((e, i) => ({
        workflowId,
        fromNode: e.from.slice(0, 40),
        toNode: e.to.slice(0, 40),
        conditionLabel: e.label ?? null,
        orderIndex: i,
      })),
    );
  }
}

async function syncAgentGrants(agentId: string, tools: string[] | null, permissions: AgentPermissionKey[] | null) {
  const db = getDb();
  if (tools) {
    await db.delete(agentToolGrants).where(eq(agentToolGrants.agentId, agentId));
    if (tools.length) {
      await db.insert(agentToolGrants).values(tools.map((toolKey) => ({ agentId, toolKey: toolKey.slice(0, 80) })));
    }
  }
  if (permissions) {
    await db.delete(agentPermissions).where(eq(agentPermissions.agentId, agentId));
    const valid = normalizePermissions(permissions);
    if (valid.length) {
      await db.insert(agentPermissions).values(valid.map((permission) => ({ agentId, permission })));
    }
  }
}

/** Kept for parity with the memory adapter's seeding helper. */
export const databaseStoreSeeds = {
  tools: async (tools: ToolRecord[]) => {
    if (!tools.length) return;
    const db = getDb();
    await db
      .insert(agentTools)
      .values(
        tools.map((t) => ({
          key: t.key,
          name: t.name,
          description: t.description,
          category: t.category,
          requiredPermission: t.requiredPermission,
          requiresApproval: t.requiresApproval,
          isDestructive: t.isDestructive,
          inputSchema: t.inputSchema,
          isActive: t.isActive,
          isBuiltin: t.isBuiltin,
        })),
      )
      .onConflictDoNothing();
  },
  budgets: async (budgets: BudgetRecord[]) => {
    if (!budgets.length) return;
    const db = getDb();
    await db
      .insert(agentBudgets)
      .values(
        budgets.map((b) => ({
          scope: b.scope,
          scopeKey: b.scopeKey ?? null,
          dailyLimitMicro: b.dailyLimitMicro,
          monthlyLimitMicro: b.monthlyLimitMicro,
          perRunLimitMicro: b.perRunLimitMicro,
          maxRunsPerDay: b.maxRunsPerDay,
          isActive: b.isActive,
        })),
      )
      .onConflictDoNothing();
  },
  integrations: async (integrations: IntegrationRecord[]) => {
    if (!integrations.length) return;
    const db = getDb();
    await db
      .insert(integrationConnections)
      .values(
        integrations.map((i) => ({
          provider: i.provider,
          label: i.label,
          baseUrl: i.baseUrl ?? null,
          secretEnvVar: i.secretEnvVar ?? null,
          authScheme: i.authScheme,
          config: i.config,
          capabilities: i.capabilities,
          isActive: i.isActive,
          healthStatus: i.healthStatus,
        })),
      )
      .onConflictDoNothing();
  },
};

/** Embedding upsert (pgvector-ready; array column always works). */
export async function upsertEmbedding(input: {
  entityType: "product" | "customer" | "room" | "style" | "query";
  entityId: string;
  model: string;
  embedding: number[];
  sourceText?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  await db
    .insert(entityEmbeddings)
    .values({
      entityType: input.entityType,
      entityId: input.entityId.slice(0, 120),
      model: input.model,
      dims: input.embedding.length,
      embedding: input.embedding,
      sourceText: input.sourceText ?? null,
      metadata: input.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [entityEmbeddings.entityType, entityEmbeddings.entityId, entityEmbeddings.model],
      set: { dims: input.embedding.length, embedding: input.embedding, sourceText: input.sourceText ?? null, updatedAt: new Date() },
    });
}
