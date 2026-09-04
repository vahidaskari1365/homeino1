// ============================================================
// HOMEINO — AGENT STORE CONTRACT
//
// One interface, two adapters:
//   • database.ts — Drizzle/Supabase (production, persistent)
//   • memory.ts   — in-process store used when DATABASE_URL is not configured
//                   (local development, previews and the test suite)
//
// Neither adapter ever fabricates catalog data: recommendations always point
// at a real product row, and the database adapter INNER JOINs products so a
// dangling recommendation cannot be returned.
// ============================================================
import type {
  AgentDefinition,
  AgentRunResult,
  AgentSchedule,
  CustomerProfileSnapshot,
  MemoryKind,
  MemoryRecord,
  RunStatus,
  StepRecord,
  TriggerKind,
  WorkflowDefinition,
  WorkflowEdgeDefinition,
  WorkflowNodeDefinition,
} from "../types";
import type { AgentPermissionKey } from "../permissions";

export interface ToolRecord {
  key: string;
  name: string;
  description: string;
  category: string;
  requiredPermission: AgentPermissionKey;
  requiresApproval: boolean;
  isDestructive: boolean;
  inputSchema: Record<string, string>;
  isActive: boolean;
  isBuiltin: boolean;
}

export interface RunRecord {
  id: string;
  workflowId?: string | null;
  workflowKey?: string | null;
  status: RunStatus;
  triggerKind: TriggerKind;
  triggerPayload: Record<string, unknown>;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  userId?: string | null;
  sessionId?: string | null;
  attempt: number;
  maxAttempts: number;
  error?: string | null;
  errorCode?: string | null;
  toolsUsed: string[];
  tokensIn: number;
  tokensOut: number;
  costMicro: number;
  model?: string | null;
  provider?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
}

export interface AgentRunRecord {
  id: string;
  agentKey: string;
  agentId?: string | null;
  runId?: string | null;
  taskId?: string | null;
  userId?: string | null;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  toolsUsed: string[];
  provider?: string | null;
  model?: string | null;
  tokensIn: number;
  tokensOut: number;
  costMicro: number;
  durationMs?: number | null;
  attempt: number;
  error?: string | null;
  errorCode?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "waiting_approval"
  | "cancelled";

export interface TaskRecord {
  id: string;
  title: string;
  type: string;
  status: TaskStatus;
  priority: number;
  agentKey?: string | null;
  workflowRunId?: string | null;
  userId?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  attempt: number;
  maxAttempts: number;
  assigneeRole: string;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLogRecord {
  id: string;
  taskId: string;
  level: string;
  message: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRecord {
  id: string;
  agentKey?: string | null;
  taskId?: string | null;
  runId?: string | null;
  action: string;
  reason?: string | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requestedBy?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
  expiresAt?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface RecommendationRecord {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  productId: string;
  vendorId?: string | null;
  scenario: string;
  score: number;
  rank: number;
  reasonCode?: string | null;
  reasonText?: string | null;
  breakdown: Record<string, number>;
  agentKey?: string | null;
  runId?: string | null;
  status: "active" | "dismissed" | "converted" | "expired";
  expiresAt?: string | null;
  createdAt: string;
  /** Real catalog product — populated on read (INNER JOIN in DB mode). */
  product?: Record<string, unknown> | null;
}

export interface EventRecord {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  anonymousId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  path?: string | null;
  metadata: Record<string, unknown>;
  device?: string | null;
  platform?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

export interface BudgetRecord {
  id: string;
  scope: "global" | "agent" | "workflow" | "user";
  scopeKey?: string | null;
  dailyLimitMicro: number;
  monthlyLimitMicro: number;
  perRunLimitMicro: number;
  maxRunsPerDay: number;
  isActive: boolean;
}

export interface IntegrationRecord {
  id: string;
  provider: string;
  label: string;
  baseUrl?: string | null;
  secretEnvVar?: string | null;
  authScheme: string;
  config: Record<string, unknown>;
  capabilities: string[];
  isActive: boolean;
  healthStatus: string;
  lastCheckedAt?: string | null;
}

export interface NewAgentInput {
  key: string;
  name: string;
  description?: string;
  type: AgentDefinition["type"];
  status?: AgentDefinition["status"];
  model?: string;
  runtime?: AgentDefinition["runtime"];
  systemPrompt?: string;
  handler?: string;
  config?: Record<string, unknown>;
  schedule?: AgentSchedule | null;
  maxRetries?: number;
  timeoutMs?: number;
  maxCostMicro?: number;
  tools?: string[];
  permissions?: AgentPermissionKey[];
  isBuiltin?: boolean;
  createdBy?: string | null;
}

export interface AgentPatch {
  name?: string;
  description?: string;
  type?: AgentDefinition["type"];
  status?: AgentDefinition["status"];
  model?: string | null;
  runtime?: AgentDefinition["runtime"];
  systemPrompt?: string | null;
  handler?: string | null;
  config?: Record<string, unknown>;
  schedule?: AgentSchedule | null;
  maxRetries?: number;
  timeoutMs?: number;
  maxCostMicro?: number;
  tools?: string[];
  permissions?: AgentPermissionKey[];
}

export interface NewWorkflowInput {
  key: string;
  name: string;
  description?: string;
  status?: WorkflowDefinition["status"];
  runtime?: WorkflowDefinition["runtime"];
  triggerKind?: TriggerKind;
  trigger?: WorkflowDefinition["trigger"];
  schedule?: AgentSchedule | null;
  config?: Record<string, unknown>;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  isBuiltin?: boolean;
  createdBy?: string | null;
}

export interface WorkflowPatch {
  name?: string;
  description?: string;
  status?: WorkflowDefinition["status"];
  runtime?: WorkflowDefinition["runtime"];
  triggerKind?: TriggerKind;
  trigger?: WorkflowDefinition["trigger"];
  schedule?: AgentSchedule | null;
  config?: Record<string, unknown>;
  nodes?: WorkflowNodeDefinition[];
  edges?: WorkflowEdgeDefinition[];
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export interface RecommendationWriteItem {
  productId: string;
  vendorId?: string | null;
  score: number;
  rank: number;
  reasonCode?: string;
  reasonText?: string;
  breakdown?: Record<string, number>;
}

export interface AgentStore {
  readonly mode: "database" | "memory";

  // ---- agents ----
  listAgents(): Promise<AgentDefinition[]>;
  getAgent(keyOrId: string): Promise<AgentDefinition | null>;
  createAgent(input: NewAgentInput): Promise<AgentDefinition>;
  updateAgent(keyOrId: string, patch: AgentPatch): Promise<AgentDefinition | null>;
  deleteAgent(keyOrId: string): Promise<boolean>;

  // ---- tools ----
  listTools(): Promise<ToolRecord[]>;

  // ---- workflows ----
  listWorkflows(): Promise<WorkflowDefinition[]>;
  getWorkflow(keyOrId: string): Promise<WorkflowDefinition | null>;
  createWorkflow(input: NewWorkflowInput): Promise<WorkflowDefinition>;
  updateWorkflow(keyOrId: string, patch: WorkflowPatch): Promise<WorkflowDefinition | null>;
  deleteWorkflow(keyOrId: string): Promise<boolean>;

  // ---- runs ----
  createRun(input: {
    workflowKey?: string | null;
    workflowId?: string | null;
    status?: RunStatus;
    triggerKind: TriggerKind;
    triggerPayload?: Record<string, unknown>;
    input?: Record<string, unknown>;
    userId?: string | null;
    sessionId?: string | null;
    maxAttempts?: number;
  }): Promise<string>;
  updateRun(
    id: string,
    patch: Partial<Pick<RunRecord, "status" | "output" | "error" | "errorCode" | "toolsUsed" | "tokensIn" | "tokensOut" | "costMicro" | "model" | "provider" | "finishedAt" | "durationMs" | "attempt">>,
  ): Promise<void>;
  getRun(id: string): Promise<RunRecord | null>;
  listRuns(filter?: { workflowKey?: string; status?: RunStatus; limit?: number }): Promise<RunRecord[]>;
  addStep(runId: string, step: StepRecord): Promise<void>;
  listSteps(runId: string): Promise<StepRecord[]>;

  // ---- agent execution log ----
  logAgentRun(record: Omit<AgentRunRecord, "id"> & { id?: string }): Promise<string>;
  listAgentRuns(filter?: { agentKey?: string; runId?: string; limit?: number; status?: RunStatus }): Promise<AgentRunRecord[]>;

  // ---- tasks ----
  createTask(input: {
    title: string;
    type?: string;
    priority?: number;
    agentKey?: string | null;
    workflowRunId?: string | null;
    userId?: string | null;
    vendorId?: string | null;
    productId?: string | null;
    payload?: Record<string, unknown>;
    assigneeRole?: string;
    maxAttempts?: number;
    dueAt?: string | null;
    status?: TaskStatus;
  }): Promise<string>;
  getTask(id: string): Promise<TaskRecord | null>;
  listTasks(filter?: { status?: TaskStatus; agentKey?: string; limit?: number }): Promise<TaskRecord[]>;
  updateTask(
    id: string,
    patch: Partial<Pick<TaskRecord, "status" | "result" | "error" | "attempt" | "startedAt" | "completedAt" | "payload" | "priority">>,
  ): Promise<void>;
  addTaskLog(taskId: string, level: string, message: string, meta?: Record<string, unknown>): Promise<void>;
  listTaskLogs(taskId: string): Promise<TaskLogRecord[]>;

  // ---- approvals ----
  createApproval(input: {
    agentKey?: string | null;
    taskId?: string | null;
    runId?: string | null;
    action: string;
    reason?: string;
    riskLevel: ApprovalRecord["riskLevel"];
    payload?: Record<string, unknown>;
    expiresAt?: string | null;
  }): Promise<string>;
  listApprovals(filter?: { status?: ApprovalStatus; limit?: number }): Promise<ApprovalRecord[]>;
  getApproval(id: string): Promise<ApprovalRecord | null>;
  decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string | null,
    note?: string,
  ): Promise<ApprovalRecord | null>;
  /** Mark a stale pending approval as expired — never as a human decision. */
  expireApproval(id: string): Promise<ApprovalRecord | null>;

  // ---- customer intelligence ----
  getProfile(userId: string): Promise<CustomerProfileSnapshot | null>;
  upsertProfile(profile: CustomerProfileSnapshot): Promise<void>;
  addMemory(
    userId: string,
    record: { kind: MemoryKind; key: string; value?: Record<string, unknown>; text?: string; importance?: number; entityType?: string; entityId?: string; agentKey?: string; metadata?: Record<string, unknown> },
  ): Promise<MemoryRecord | null>;
  listMemories(userId: string, opts?: { kind?: MemoryKind; limit?: number }): Promise<MemoryRecord[]>;
  deleteMemory(userId: string, kind: MemoryKind, key: string): Promise<boolean>;

  // ---- recommendations ----
  saveRecommendations(input: {
    userId?: string | null;
    sessionId?: string | null;
    scenario: string;
    agentKey?: string | null;
    runId?: string | null;
    items: RecommendationWriteItem[];
    contextSnapshot?: Record<string, unknown>;
    replace?: boolean;
    ttlHours?: number;
  }): Promise<number>;
  listRecommendations(filter?: {
    userId?: string | null;
    sessionId?: string | null;
    scenario?: string;
    status?: RecommendationRecord["status"];
    limit?: number;
  }): Promise<RecommendationRecord[]>;
  setRecommendationStatus(id: string, status: RecommendationRecord["status"]): Promise<void>;

  // ---- events ----
  recordEvent(input: {
    userId?: string | null;
    sessionId?: string | null;
    anonymousId?: string | null;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    path?: string | null;
    metadata?: Record<string, unknown>;
    device?: string | null;
    platform?: string | null;
    createdAt?: string;
  }): Promise<string>;
  listEvents(filter?: {
    userId?: string | null;
    sessionId?: string | null;
    eventTypes?: string[];
    since?: Date;
    limit?: number;
  }): Promise<EventRecord[]>;
  markEventsProcessed(ids: string[]): Promise<void>;

  // ---- budgets / cost control ----
  listBudgets(): Promise<BudgetRecord[]>;
  upsertBudget(input: {
    scope: BudgetRecord["scope"];
    scopeKey?: string | null;
    dailyLimitMicro?: number;
    monthlyLimitMicro?: number;
    perRunLimitMicro?: number;
    maxRunsPerDay?: number;
    isActive?: boolean;
  }): Promise<BudgetRecord | null>;
  usageSince(scope: { kind: "global" | "agent" | "workflow" | "user"; key?: string | null; since: Date }): Promise<{
    costMicro: number;
    runs: number;
    tokensIn: number;
    tokensOut: number;
  }>;

  // ---- integrations ----
  listIntegrations(): Promise<IntegrationRecord[]>;
  updateIntegration(
    provider: string,
    patch: Partial<Pick<IntegrationRecord, "baseUrl" | "isActive" | "config" | "healthStatus" | "label" | "secretEnvVar" | "capabilities">>,
  ): Promise<IntegrationRecord | null>;
}

/** Convenience: shape an AgentRunResult into a storable record. */
export function agentRunRecordFromResult(
  result: AgentRunResult,
  meta: { id?: string; runId?: string | null; taskId?: string | null; userId?: string | null; attempt?: number; startedAt: string; agentId?: string | null },
): Omit<AgentRunRecord, "id"> & { id?: string } {
  return {
    id: meta.id,
    agentKey: result.agentKey,
    agentId: meta.agentId ?? null,
    runId: meta.runId ?? null,
    taskId: meta.taskId ?? null,
    userId: meta.userId ?? null,
    status: result.status,
    input: {},
    output: result.output,
    toolsUsed: result.toolsUsed,
    provider: result.usage.provider,
    model: result.usage.model,
    tokensIn: result.usage.tokensIn,
    tokensOut: result.usage.tokensOut,
    costMicro: result.usage.costMicro,
    durationMs: result.usage.durationMs,
    attempt: meta.attempt ?? result.attempts,
    error: result.error ?? null,
    errorCode: result.errorCode ?? null,
    startedAt: meta.startedAt,
    finishedAt: new Date().toISOString(),
  };
}
