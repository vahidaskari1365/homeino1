// ============================================================
// HOMEINO — AGENT ORCHESTRATOR · CORE TYPES
//
// These contracts are deliberately provider-agnostic so the runtime can be
// swapped between:
//   • the built-in local orchestrator (default, always available)
//   • Dify            (POST {base}/workflows/run — Bearer app API key)
//   • Langflow        (POST {base}/api/v1/run/{flowId} — x-api-key)
//   • Ollama          (local open-source models for the LLM step)
//   • Mem0            (long-term memory store)
//   • Browser Use / Stagehand (browser automation runtimes)
//
// GOLDEN RULES (enforced by outputGuard.ts, not by convention):
//   1. An agent may only reference catalog entities that exist.
//   2. No fabricated productId / SKU / price / storeId / URL / stock.
//   3. Not enough real data ⇒ "no_data" / "not_enough_data", never guesses.
// ============================================================

import type { AgentPermissionKey } from "./permissions";

// ---------------------------------------------------------------
// Agents
// ---------------------------------------------------------------
export type AgentType =
  | "analyzer"
  | "generator"
  | "executor"
  | "assistant"
  | "browser"
  | "notifier";

export type AgentStatus = "draft" | "active" | "paused" | "archived";

export type AgentRuntimeKind = "local" | "dify" | "langflow" | "ollama";

export interface AgentSchedule {
  kind: "manual" | "interval" | "daily" | "weekly" | "cron";
  /** minutes — for `interval` */
  everyMinutes?: number;
  /** "09:00" — for `daily` / `weekly` */
  at?: string;
  /** 0-6 (Sunday=0) or name — for `weekly` */
  weekday?: number | string;
  /** cron expression — for `cron` */
  cron?: string;
  timezone?: string;
}

export interface AgentDefinition {
  id?: string;
  key: string;
  name: string;
  description?: string;
  type: AgentType;
  status: AgentStatus;
  model?: string;
  runtime: AgentRuntimeKind;
  systemPrompt?: string;
  /** Built-in handler key (see handlers/index.ts). Custom agents may be
   *  fully declarative: tools + prompt + output schema, executed generically. */
  handler?: string;
  config: Record<string, unknown>;
  schedule?: AgentSchedule | null;
  maxRetries: number;
  timeoutMs: number;
  maxCostMicro: number;
  tools: string[];
  permissions: AgentPermissionKey[];
  isBuiltin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentRunRequest {
  agentKey: string;
  input: Record<string, unknown>;
  userId?: string | null;
  sessionId?: string | null;
  /** Parent workflow run (observability link). */
  runId?: string | null;
  taskId?: string | null;
  triggeredBy?: string;
  /** Free-form ambient context (page, room, current product…). */
  context?: Record<string, unknown>;
}

export interface TokenUsage {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Integer micro-units (1/1_000_000). Never a float. */
  costMicro: number;
  durationMs: number;
}

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_approval";

export interface AgentRunResult {
  ok: boolean;
  status: RunStatus;
  agentKey: string;
  agentRunId?: string;
  output: Record<string, unknown>;
  toolsUsed: string[];
  usage: TokenUsage;
  attempts: number;
  error?: string;
  errorCode?: AgentErrorCode;
  /** Set when the run paused for a human decision. */
  approval?: { id: string; action: string; risk: string };
  /** Honest signal — the UI must show this instead of inventing data. */
  dataState?: "ok" | "no_data" | "not_enough_data" | "degraded";
}

export type AgentErrorCode =
  | "AGENT_NOT_FOUND"
  | "AGENT_INACTIVE"
  | "PERMISSION_DENIED"
  | "TOOL_NOT_GRANTED"
  | "TOOL_FAILED"
  | "VALIDATION_FAILED"
  | "BUDGET_EXCEEDED"
  | "TIMEOUT"
  | "CANCELLED"
  | "APPROVAL_REQUIRED"
  | "PROVIDER_ERROR"
  | "NO_DATA"
  | "INTERNAL";

/** The pluggable agent runtime contract (local · Dify · Langflow · Ollama). */
export interface AgentRuntime {
  readonly name: AgentRuntimeKind | string;
  run(req: AgentRunRequest): Promise<AgentRunResult>;
  cancel(agentRunId: string): Promise<void>;
  getStatus(agentRunId: string): Promise<RunStatus | null>;
  /** False when the external provider is not configured (callers must fall back). */
  available?: boolean;
  /** Why this runtime cannot be used right now — shown honestly in the admin panel. */
  error?: string | null;
}

// ---------------------------------------------------------------
// Tools
// ---------------------------------------------------------------
export interface ToolCallContext {
  agentKey: string;
  permissions: AgentPermissionKey[];
  grantedTools: string[];
  userId?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  actorRole: "system" | "admin" | "vendor" | "customer";
  /** Nested tool call (guarded against loops). */
  callTool: (key: string, input: Record<string, unknown>) => Promise<unknown>;
  log: (message: string, meta?: Record<string, unknown>) => void;
  /** Bump by the tool when it consumed LLM tokens. */
  addUsage: (usage: Partial<TokenUsage>) => void;
  depth: number;
}

export interface AgentToolDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  requiredPermission: AgentPermissionKey;
  requiresApproval?: boolean;
  isDestructive?: boolean;
  inputSchema: Record<string, string>;
  execute(input: Record<string, unknown>, ctx: ToolCallContext): Promise<unknown>;
}

// ---------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------
export type WorkflowNodeType =
  | "trigger"
  | "condition"
  | "agent"
  | "db_query"
  | "db_update"
  | "recommendation"
  | "notification"
  | "delay"
  | "schedule"
  | "human_approval"
  | "http_request"
  | "browser_task"
  | "end";

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type TriggerKind = "event" | "schedule" | "manual" | "webhook";

export interface WorkflowNodeDefinition {
  key: string;
  type: WorkflowNodeType;
  label?: string;
  agentKey?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdgeDefinition {
  from: string;
  to: string;
  /** Branch selector emitted by a condition node (`true`/`false`/custom). */
  label?: string | null;
}

export interface WorkflowDefinition {
  id?: string;
  key: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  /** local (in-repo engine) · dify · langflow — always falls back to local. */
  runtime?: "local" | "dify" | "langflow";
  version: number;
  triggerKind: TriggerKind;
  trigger: {
    eventTypes?: string[];
    minEvents?: number;
    windowMinutes?: number;
    entityTypes?: string[];
    condition?: string;
    kind?: string;
  };
  schedule?: AgentSchedule | null;
  config: Record<string, unknown>;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  isBuiltin?: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StepRecord {
  nodeKey: string;
  nodeType: WorkflowNodeType;
  label?: string;
  agentKey?: string;
  status: RunStatus | "skipped" | "pending";
  attempt: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  tokensIn: number;
  tokensOut: number;
  costMicro: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface WorkflowRunRequest {
  workflowKey: string;
  triggerKind: TriggerKind;
  triggerPayload?: Record<string, unknown>;
  input?: Record<string, unknown>;
  userId?: string | null;
  sessionId?: string | null;
  actorRole?: "system" | "admin" | "vendor" | "customer";
  actorId?: string | null;
}

export interface WorkflowRunResult {
  ok: boolean;
  status: RunStatus;
  runId?: string;
  workflowKey: string;
  output: Record<string, unknown>;
  steps: StepRecord[];
  usage: TokenUsage;
  error?: string;
  errorCode?: AgentErrorCode;
  dataState?: "ok" | "no_data" | "not_enough_data" | "degraded";
}

export interface WorkflowValidationIssue {
  level: "error" | "warning";
  nodeKey?: string;
  message: string;
}

/** The pluggable workflow runtime contract (local · Dify · Langflow). */
export interface WorkflowRuntime {
  readonly name: string;
  execute(req: WorkflowRunRequest): Promise<WorkflowRunResult>;
  validate(def: WorkflowDefinition): Promise<WorkflowValidationIssue[]>;
  schedule(def: WorkflowDefinition, schedule: AgentSchedule): Promise<{ nextRunAt: Date | null }>;
  /** False when the external provider is not configured (callers must fall back). */
  available?: boolean;
  error?: string | null;
}

// ---------------------------------------------------------------
// Memory (Mem0-shaped: add / search / update / delete)
// ---------------------------------------------------------------
export type MemoryKind =
  | "preference"
  | "interaction"
  | "design"
  | "request"
  | "recommendation"
  | "dismissal"
  | "purchase"
  | "note";

export interface MemoryRecord {
  id: string;
  userId: string;
  kind: MemoryKind;
  key: string;
  value: Record<string, unknown>;
  text?: string;
  importance: number;
  hits: number;
  entityType?: string;
  entityId?: string;
  agentKey?: string;
  metadata?: Record<string, unknown>;
  score?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryProvider {
  readonly name: string;
  add(userId: string, record: Omit<MemoryRecord, "id" | "userId">): Promise<MemoryRecord | null>;
  search(userId: string, query: string, opts?: { kind?: MemoryKind; limit?: number }): Promise<MemoryRecord[]>;
  all(userId: string, opts?: { kind?: MemoryKind; limit?: number }): Promise<MemoryRecord[]>;
  remove(userId: string, key: string, kind: MemoryKind): Promise<boolean>;
}

// ---------------------------------------------------------------
// Browser automation (Browser Use / Stagehand shaped)
// ---------------------------------------------------------------
export type BrowserAction = "goto" | "act" | "extract" | "observe";

export interface BrowserTaskRequest {
  url: string;
  instruction: string;
  action?: BrowserAction;
  allowedDomains: string[];
  maxSteps?: number;
  /** Fields the extraction must return — nothing else is accepted. */
  schema?: Record<string, string>;
  agentKey: string;
  runId?: string | null;
}

export interface BrowserTaskResult {
  ok: boolean;
  provider: string;
  url: string;
  action: BrowserAction;
  data: Record<string, unknown>;
  steps: number;
  error?: string;
  /** True when the runtime is not configured — never pretend it ran. */
  notConfigured?: boolean;
}

export interface BrowserRuntime {
  readonly name: string;
  isConfigured(): boolean;
  run(req: BrowserTaskRequest): Promise<BrowserTaskResult>;
}

// ---------------------------------------------------------------
// Customer intelligence
// ---------------------------------------------------------------
export interface CustomerProfileSnapshot {
  userId: string | null;
  sessionId?: string | null;
  preferredStyles: string[];
  preferredColors: string[];
  preferredCategories: string[];
  preferredMaterials: string[];
  preferredRooms: string[];
  preferredStores: string[];
  preferredPriceRange: { min?: number; max?: number };
  recentInterests: { entityId?: string; entityType?: string; label?: string; weight: number }[];
  purchasePatterns: { label: string; count: number }[];
  /** 0..1 — driven by how much REAL evidence exists. */
  confidence: number;
  eventCount: number;
  dataState: "ok" | "no_data" | "not_enough_data";
  computedAt: string;
}
