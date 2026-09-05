// ============================================================
// Admin automation console — API client helpers
//
// Thin wrapper over the app-wide apiClient so every panel gets the same
// envelope unwrapping and the same honest Persian error messages.
// ============================================================
import { api, apiErrorMessage, type ApiErr } from "@/lib/apiClient";

interface Envelope<T> {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

function describeError(err: ApiErr): string {
  const details = err.details as Envelope<unknown> | undefined;
  const message = details?.error?.message;
  return message && message.trim() ? message : apiErrorMessage(err);
}

export async function getJson<T>(path: string, opts?: { timeoutMs?: number }): Promise<T> {
  const res = await api.get<Envelope<T>>(path, { timeoutMs: opts?.timeoutMs ?? 20_000, retries: 1 });
  if (!res.ok) throw new Error(describeError(res));
  const payload = res.data;
  if (!payload || payload.data === undefined) throw new Error("پاسخ سرور خالی بود");
  return payload.data as T;
}

export async function sendJson<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const opts = { timeoutMs: 60_000, retries: 0 };
  const result =
    method === "POST"
      ? await api.post<Envelope<T>>(path, body, opts)
      : method === "PATCH"
        ? await api.patch<Envelope<T>>(path, body, opts)
        : method === "PUT"
          ? await api.put<Envelope<T>>(path, body, opts)
          : await api.delete<Envelope<T>>(path, opts);
  if (!result.ok) throw new Error(describeError(result));
  const payload = result.data;
  if (!payload || payload.data === undefined) throw new Error("پاسخ سرور خالی بود");
  return payload.data as T;
}

/** `api.delete` takes no body — the recommendations endpoint is the only DELETE with one. */
export async function deleteJson<T>(path: string, body?: unknown): Promise<T> {
  const { apiCall } = await import("@/lib/apiClient");
  const result = await apiCall<Envelope<T>>(path, { method: "DELETE", json: body, timeoutMs: 30_000, retries: 0 });
  if (!result.ok) throw new Error(describeError(result));
  const payload = result.data;
  if (!payload || payload.data === undefined) throw new Error("پاسخ سرور خالی بود");
  return payload.data as T;
}

// ------------------------------------------------------------
// Shapes returned by /api/automation/* (kept loose — the server validates)
// ------------------------------------------------------------
export interface AgentRow {
  key: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  runtime?: string;
  handler?: string | null;
  tools: string[];
  permissions: string[];
  maxRetries?: number;
  timeoutMs?: number;
  isBuiltin?: boolean;
  config?: Record<string, unknown>;
  systemPrompt?: string | null;
  schedule?: Record<string, unknown> | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
}

export interface ToolRow {
  key: string;
  name: string;
  description: string;
  category: string;
  requiredPermission: string;
  requiresApproval: boolean;
  isDestructive: boolean;
  inputSchema: Record<string, string>;
  isActive: boolean;
  isBuiltin?: boolean;
}

export interface WorkflowNodeRow {
  key: string;
  type: string;
  label?: string;
  agentKey?: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdgeRow {
  from: string;
  to: string;
  label?: string | null;
}

export interface WorkflowRow {
  key: string;
  name: string;
  description?: string;
  status: string;
  runtime?: string;
  triggerKind: string;
  trigger?: Record<string, unknown>;
  schedule?: Record<string, unknown> | null;
  nodes: WorkflowNodeRow[];
  edges: WorkflowEdgeRow[];
  isBuiltin?: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  version?: number;
}

export interface TaskRow {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: number;
  agentKey?: string | null;
  assigneeRole?: string;
  attempt: number;
  maxAttempts: number;
  error?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  createdAt?: string;
  dueAt?: string | null;
}

export interface ApprovalRow {
  id: string;
  agentKey?: string | null;
  action: string;
  reason?: string | null;
  riskLevel: string;
  status: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  expiresAt?: string | null;
  decidedBy?: string | null;
}

export interface AgentRunRow {
  id: string;
  agentKey: string;
  status: string;
  toolsUsed: string[];
  tokensIn: number;
  tokensOut: number;
  costMicro: number;
  durationMs?: number | null;
  attempt: number;
  error?: string | null;
  errorCode?: string | null;
  startedAt: string;
  provider?: string | null;
  model?: string | null;
}

export interface WorkflowRunRow {
  id: string;
  workflowKey?: string | null;
  status: string;
  triggerKind: string;
  attempt: number;
  toolsUsed: string[];
  tokensIn: number;
  tokensOut: number;
  costMicro: number;
  durationMs?: number | null;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface StepRow {
  nodeKey: string;
  nodeType: string;
  label?: string;
  agentKey?: string;
  status: string;
  attempt: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  tokensIn: number;
  tokensOut: number;
  costMicro: number;
  startedAt?: string;
  durationMs?: number | null;
}
