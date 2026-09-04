import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps, createdAtColumn, updatedAtColumn } from "./_base";
import { users } from "./users";
import { products } from "./products";
import { vendors } from "./vendors";

// ============================================================
// HOMEINO — AGENTIC CORE SCHEMA
//
// Everything the Agent Orchestrator persists:
//   agents · tools · permissions · workflows (graph) · runs · steps
//   tasks · task logs · approvals · execution logs · budgets
//   customer profiles · customer memory · recommendations
//   analytics events · embeddings · external integrations
//
// Design rules:
//   • Nothing here stores secrets — API keys live in server env only
//     (integration_connections keeps the *name* of the env var).
//   • Money/cost are integers (micro units) — never floats.
//   • Every agent output that touches the catalog must reference a real
//     products.id / vendors.id (FK enforced where a row is persisted).
// ============================================================

// ---------------------------------------------------------------
// Enums
// ---------------------------------------------------------------
export const agentTypeEnum = pgEnum("agent_type", [
  "analyzer",
  "generator",
  "executor",
  "assistant",
  "browser",
  "notifier",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const workflowNodeTypeEnum = pgEnum("workflow_node_type", [
  "trigger",
  "condition",
  "agent",
  "db_query",
  "db_update",
  "recommendation",
  "notification",
  "delay",
  "schedule",
  "human_approval",
  "http_request",
  "browser_task",
  "end",
]);

export const runStatusEnum = pgEnum("agent_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "waiting_approval",
]);

export const stepStatusEnum = pgEnum("agent_step_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "cancelled",
  "waiting_approval",
]);

export const taskStatusEnum = pgEnum("agent_task_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "waiting_approval",
  "cancelled",
]);

export const approvalStatusEnum = pgEnum("agent_approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const riskLevelEnum = pgEnum("agent_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "active",
  "dismissed",
  "converted",
  "expired",
]);

export const memoryKindEnum = pgEnum("customer_memory_kind", [
  "preference",
  "interaction",
  "design",
  "request",
  "recommendation",
  "dismissal",
  "purchase",
  "note",
]);

export const embeddingEntityEnum = pgEnum("embedding_entity", [
  "product",
  "customer",
  "room",
  "style",
  "query",
]);

export const budgetScopeEnum = pgEnum("agent_budget_scope", [
  "global",
  "agent",
  "workflow",
  "user",
]);

export const triggerKindEnum = pgEnum("workflow_trigger_kind", [
  "event",
  "schedule",
  "manual",
  "webhook",
]);

// ---------------------------------------------------------------
// Agents — dynamic registry (admin can create new ones)
// ---------------------------------------------------------------
export const agents = pgTable(
  "agents",
  {
    id: id(),
    /** Stable machine key, e.g. `customer-intelligence`. */
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    type: agentTypeEnum("type").notNull().default("analyzer"),
    status: agentStatusEnum("status").notNull().default("draft"),
    /** Logical model id — resolved by the LLM gateway at run time. */
    model: varchar("model", { length: 120 }),
    /** Optional runtime override: local | dify | langflow | ollama. */
    runtime: varchar("runtime", { length: 40 }).notNull().default("local"),
    systemPrompt: text("system_prompt"),
    /** Handler key inside the built-in agent registry (`defaults.ts`). */
    handler: varchar("handler", { length: 80 }),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    schedule: jsonb("schedule").$type<Record<string, unknown>>(),
    maxRetries: integer("max_retries").notNull().default(2),
    timeoutMs: integer("timeout_ms").notNull().default(30000),
    /** Micro-cost ceiling for a single run (0 = inherit budget table). */
    maxCostMicro: integer("max_cost_micro").notNull().default(0),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("agents_key_unique").on(t.key),
    index("agents_status_idx").on(t.status),
    index("agents_type_idx").on(t.type),
  ],
);

// ---------------------------------------------------------------
// Tool registry — agents only ever see tools they are granted
// ---------------------------------------------------------------
export const agentTools = pgTable(
  "agent_tools",
  {
    id: id(),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 60 }).notNull().default("general"),
    /** Permission required to call this tool (see permissions.ts). */
    requiredPermission: varchar("required_permission", { length: 80 }).notNull(),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    isDestructive: boolean("is_destructive").notNull().default(false),
    inputSchema: jsonb("input_schema").$type<Record<string, unknown>>().default({}),
    isActive: boolean("is_active").notNull().default(true),
    isBuiltin: boolean("is_builtin").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("agent_tools_key_unique").on(t.key)],
);

export const agentToolGrants = pgTable(
  "agent_tool_grants",
  {
    id: id(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    toolKey: varchar("tool_key", { length: 80 }).notNull(),
    /** Per-grant overrides (limits, allowlists). */
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("agent_tool_grants_unique").on(t.agentId, t.toolKey),
    index("agent_tool_grants_agent_idx").on(t.agentId),
  ],
);

export const agentPermissions = pgTable(
  "agent_permissions",
  {
    id: id(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 80 }).notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("agent_permissions_unique").on(t.agentId, t.permission),
    index("agent_permissions_agent_idx").on(t.agentId),
  ],
);

// ---------------------------------------------------------------
// Workflows — graph of nodes + edges (Dify/Langflow-shaped)
// ---------------------------------------------------------------
export const workflows = pgTable(
  "workflows",
  {
    id: id(),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    status: workflowStatusEnum("status").notNull().default("draft"),
    /** Where this workflow executes: local engine · Dify · Langflow. */
    runtime: varchar("runtime", { length: 30 }).notNull().default("local"),
    version: integer("version").notNull().default(1),
    triggerKind: triggerKindEnum("trigger_kind").notNull().default("manual"),
    /** { eventTypes: string[], condition?: {...} } for event triggers. */
    trigger: jsonb("trigger").$type<Record<string, unknown>>().default({}),
    /** { kind: "manual"|"interval"|"daily"|"weekly"|"cron", ... } */
    schedule: jsonb("schedule").$type<Record<string, unknown>>(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("workflows_key_unique").on(t.key),
    index("workflows_status_idx").on(t.status),
    index("workflows_next_run_idx").on(t.nextRunAt),
  ],
);

export const workflowNodes = pgTable(
  "workflow_nodes",
  {
    id: id(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    /** Local node key, unique inside the workflow (e.g. `n1`). */
    nodeKey: varchar("node_key", { length: 40 }).notNull(),
    type: workflowNodeTypeEnum("type").notNull(),
    label: varchar("label", { length: 160 }),
    /** Agent key when type = 'agent'. */
    agentKey: varchar("agent_key", { length: 80 }),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    position: jsonb("position").$type<{ x: number; y: number }>().default({ x: 0, y: 0 }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (t) => [
    uniqueIndex("workflow_nodes_key_unique").on(t.workflowId, t.nodeKey),
    index("workflow_nodes_workflow_idx").on(t.workflowId),
  ],
);

export const workflowEdges = pgTable(
  "workflow_edges",
  {
    id: id(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    fromNode: varchar("from_node", { length: 40 }).notNull(),
    toNode: varchar("to_node", { length: 40 }).notNull(),
    /** Optional branch label: `true` | `false` | custom. */
    conditionLabel: varchar("condition_label", { length: 40 }),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [
    uniqueIndex("workflow_edges_unique").on(t.workflowId, t.fromNode, t.toNode, t.conditionLabel),
    index("workflow_edges_workflow_idx").on(t.workflowId),
  ],
);

// ---------------------------------------------------------------
// Runs + steps — observability for every execution
// ---------------------------------------------------------------
export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: id(),
    workflowId: uuid("workflow_id").references(() => workflows.id, {
      onDelete: "set null",
    }),
    workflowKey: varchar("workflow_key", { length: 80 }),
    status: runStatusEnum("status").notNull().default("queued"),
    triggerKind: triggerKindEnum("trigger_kind").notNull().default("manual"),
    triggerPayload: jsonb("trigger_payload").$type<Record<string, unknown>>().default({}),
    input: jsonb("input").$type<Record<string, unknown>>().default({}),
    output: jsonb("output").$type<Record<string, unknown>>(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 80 }),
    attempt: integer("attempt").notNull().default(1),
    maxAttempts: integer("max_attempts").notNull().default(1),
    error: text("error"),
    errorCode: varchar("error_code", { length: 60 }),
    toolsUsed: jsonb("tools_used").$type<string[]>().default([]),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    /** Estimated cost in micro units (1/1_000_000). Integer, never float. */
    costMicro: integer("cost_micro").notNull().default(0),
    model: varchar("model", { length: 120 }),
    provider: varchar("provider", { length: 60 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("workflow_runs_workflow_idx").on(t.workflowId),
    index("workflow_runs_status_idx").on(t.status),
    index("workflow_runs_started_idx").on(t.startedAt),
    index("workflow_runs_user_idx").on(t.userId),
  ],
);

export const workflowRunSteps = pgTable(
  "workflow_run_steps",
  {
    id: id(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    nodeKey: varchar("node_key", { length: 40 }).notNull(),
    nodeType: workflowNodeTypeEnum("type").notNull(),
    label: varchar("label", { length: 160 }),
    agentKey: varchar("agent_key", { length: 80 }),
    status: stepStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(1),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicro: integer("cost_micro").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (t) => [index("workflow_run_steps_run_idx").on(t.runId)],
);

/** One row per agent execution (inside or outside a workflow). */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    agentKey: varchar("agent_key", { length: 80 }).notNull(),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "cascade" }),
    taskId: uuid("task_id"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    status: runStatusEnum("status").notNull().default("queued"),
    input: jsonb("input").$type<Record<string, unknown>>().default({}),
    output: jsonb("output").$type<Record<string, unknown>>(),
    toolsUsed: jsonb("tools_used").$type<string[]>().default([]),
    provider: varchar("provider", { length: 60 }),
    model: varchar("model", { length: 120 }),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicro: integer("cost_micro").notNull().default(0),
    durationMs: integer("duration_ms"),
    attempt: integer("attempt").notNull().default(1),
    error: text("error"),
    errorCode: varchar("error_code", { length: 60 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("agent_runs_agent_idx").on(t.agentKey),
    index("agent_runs_run_idx").on(t.runId),
    index("agent_runs_status_idx").on(t.status),
    index("agent_runs_started_idx").on(t.startedAt),
  ],
);

// ---------------------------------------------------------------
// Task queue + logs + approvals
// ---------------------------------------------------------------
export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: id(),
    title: varchar("title", { length: 200 }).notNull(),
    type: varchar("type", { length: 80 }).notNull().default("generic"),
    status: taskStatusEnum("status").notNull().default("pending"),
    priority: integer("priority").notNull().default(0),
    agentKey: varchar("agent_key", { length: 80 }),
    workflowRunId: uuid("workflow_run_id").references(() => workflowRuns.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    assigneeRole: varchar("assignee_role", { length: 40 }).notNull().default("admin"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("agent_tasks_status_idx").on(t.status),
    index("agent_tasks_agent_idx").on(t.agentKey),
    index("agent_tasks_priority_idx").on(t.priority, t.createdAt),
  ],
);

export const agentTaskLogs = pgTable(
  "agent_task_logs",
  {
    id: id(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 16 }).notNull().default("info"),
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: createdAtColumn,
  },
  (t) => [index("agent_task_logs_task_idx").on(t.taskId)],
);

export const agentApprovals = pgTable(
  "agent_approvals",
  {
    id: id(),
    agentKey: varchar("agent_key", { length: 80 }),
    taskId: uuid("task_id").references(() => agentTasks.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 120 }).notNull(),
    reason: text("reason"),
    riskLevel: riskLevelEnum("risk_level").notNull().default("medium"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    status: approvalStatusEnum("status").notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decisionNote: text("decision_note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAtColumn,
  },
  (t) => [
    index("agent_approvals_status_idx").on(t.status),
    index("agent_approvals_task_idx").on(t.taskId),
  ],
);

// ---------------------------------------------------------------
// Cost control
// ---------------------------------------------------------------
export const agentBudgets = pgTable(
  "agent_budgets",
  {
    id: id(),
    scope: budgetScopeEnum("scope").notNull().default("global"),
    /** agent key / workflow key / user id — null for global. */
    scopeKey: varchar("scope_key", { length: 120 }),
    dailyLimitMicro: integer("daily_limit_micro").notNull().default(0),
    monthlyLimitMicro: integer("monthly_limit_micro").notNull().default(0),
    perRunLimitMicro: integer("per_run_limit_micro").notNull().default(0),
    maxRunsPerDay: integer("max_runs_per_day").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("agent_budgets_scope_unique").on(t.scope, t.scopeKey)],
);

// ---------------------------------------------------------------
// Customer intelligence: profile + long-term memory
// ---------------------------------------------------------------
export const customerProfiles = pgTable(
  "customer_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    preferredStyles: jsonb("preferred_styles").$type<string[]>().default([]),
    preferredColors: jsonb("preferred_colors").$type<string[]>().default([]),
    preferredCategories: jsonb("preferred_categories").$type<string[]>().default([]),
    preferredMaterials: jsonb("preferred_materials").$type<string[]>().default([]),
    preferredRooms: jsonb("preferred_rooms").$type<string[]>().default([]),
    preferredStores: jsonb("preferred_stores").$type<string[]>().default([]),
    preferredPriceMin: integer("preferred_price_min"),
    preferredPriceMax: integer("preferred_price_max"),
    recentInterests: jsonb("recent_interests").$type<Record<string, unknown>[]>().default([]),
    purchasePatterns: jsonb("purchase_patterns").$type<Record<string, unknown>[]>().default([]),
    /** 0..100 — how much real evidence backs this profile. */
    confidence: integer("confidence").notNull().default(0),
    eventCount: integer("event_count").notNull().default(0),
    source: varchar("source", { length: 60 }).notNull().default("agent"),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("customer_profiles_confidence_idx").on(t.confidence)],
);

export const customerMemories = pgTable(
  "customer_memories",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: memoryKindEnum("kind").notNull().default("note"),
    /** Stable dedupe key inside (user, kind) — e.g. `style:modern`. */
    memoryKey: varchar("memory_key", { length: 160 }).notNull(),
    value: jsonb("value").$type<Record<string, unknown>>().default({}),
    text: text("text"),
    importance: integer("importance").notNull().default(1),
    hits: integer("hits").notNull().default(0),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: varchar("entity_id", { length: 80 }),
    agentKey: varchar("agent_key", { length: 80 }),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customer_memories_unique").on(t.userId, t.kind, t.memoryKey),
    index("customer_memories_user_idx").on(t.userId),
    index("customer_memories_kind_idx").on(t.kind),
  ],
);

// ---------------------------------------------------------------
// Recommendations — always pointing at a REAL product row
// ---------------------------------------------------------------
export const recommendations = pgTable(
  "recommendations",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 80 }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    /** Placement scenario: home | product_detail | cart | wishlist | search | account | ai_designer */
    scenario: varchar("scenario", { length: 60 }).notNull().default("home"),
    score: doublePrecision("score").notNull().default(0),
    rank: integer("rank").notNull().default(0),
    reasonCode: varchar("reason_code", { length: 80 }),
    reasonText: varchar("reason_text", { length: 240 }),
    breakdown: jsonb("breakdown").$type<Record<string, number>>().default({}),
    agentKey: varchar("agent_key", { length: 80 }),
    runId: uuid("run_id").references(() => workflowRuns.id, { onDelete: "set null" }),
    contextSnapshot: jsonb("context_snapshot").$type<Record<string, unknown>>().default({}),
    status: recommendationStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAtColumn,
  },
  (t) => [
    index("recommendations_user_idx").on(t.userId, t.scenario, t.status),
    index("recommendations_session_idx").on(t.sessionId),
    index("recommendations_product_idx").on(t.productId),
    index("recommendations_created_idx").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------
// Event tracking — the behavioural source of truth
// ---------------------------------------------------------------
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 80 }),
    anonymousId: varchar("anonymous_id", { length: 80 }),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: varchar("entity_id", { length: 120 }),
    path: varchar("path", { length: 300 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    device: varchar("device", { length: 20 }),
    platform: varchar("platform", { length: 20 }),
    /** Set once a workflow consumed the event (trigger fan-out bookkeeping). */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAtColumn,
  },
  (t) => [
    index("analytics_events_type_idx").on(t.eventType, t.createdAt),
    index("analytics_events_user_idx").on(t.userId, t.createdAt),
    index("analytics_events_session_idx").on(t.sessionId),
    index("analytics_events_entity_idx").on(t.entityType, t.entityId),
  ],
);

// ---------------------------------------------------------------
// Semantic layer — embeddings (pgvector-ready)
//
// `embedding` is a plain double precision[] so the table works on any
// Postgres. The migration additionally creates `embedding_vec vector(n)`
// + ANN index when the pgvector extension is available.
// ---------------------------------------------------------------
export const entityEmbeddings = pgTable(
  "entity_embeddings",
  {
    id: id(),
    entityType: embeddingEntityEnum("entity_type").notNull(),
    entityId: varchar("entity_id", { length: 120 }).notNull(),
    model: varchar("model", { length: 120 }).notNull().default("homeino-lexical-v1"),
    dims: integer("dims").notNull().default(0),
    embedding: doublePrecision("embedding").array().notNull(),
    sourceText: text("source_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (t) => [
    uniqueIndex("entity_embeddings_unique").on(t.entityType, t.entityId, t.model),
    index("entity_embeddings_type_idx").on(t.entityType),
  ],
);

// ---------------------------------------------------------------
// External integrations (Dify · Langflow · Ollama · Mem0 · Browser Use · Stagehand)
// Secrets are NEVER stored — only the env var name that holds them.
// ---------------------------------------------------------------
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: id(),
    provider: varchar("provider", { length: 40 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    baseUrl: text("base_url"),
    /** e.g. `DIFY_API_KEY` — the value stays in the server environment. */
    secretEnvVar: varchar("secret_env_var", { length: 80 }),
    authScheme: varchar("auth_scheme", { length: 40 }).notNull().default("bearer"),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    capabilities: jsonb("capabilities").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(false),
    healthStatus: varchar("health_status", { length: 24 }).notNull().default("unknown"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("integration_connections_provider_unique").on(t.provider)],
);

// ---- Row types ----
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentTool = typeof agentTools.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowNode = typeof workflowNodes.$inferSelect;
export type WorkflowEdge = typeof workflowEdges.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type WorkflowRunStep = typeof workflowRunSteps.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentTask = typeof agentTasks.$inferSelect;
export type AgentApproval = typeof agentApprovals.$inferSelect;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type CustomerMemory = typeof customerMemories.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
