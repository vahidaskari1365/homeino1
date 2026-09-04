// ============================================================
// HOMEINO — AGENT HANDLER CONTRACT
//
// A handler is the executable part of an agent. Built-in agents ship with a
// dedicated handler; agents created by an admin in the panel run through the
// declarative handler (LLM + granted tools), so nothing has to be hard-coded.
// ============================================================
import type { AgentDefinition, TokenUsage } from "../types";
import type { AgentPermissionKey } from "../permissions";

export interface ToolCallResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  code?: string;
  approvalRequired?: boolean;
  approvalId?: string;
}

export interface HandlerContext {
  agent: AgentDefinition;
  userId: string | null;
  sessionId: string | null;
  runId: string | null;
  taskId: string | null;
  actorRole: "system" | "admin" | "vendor" | "customer";
  permissions: AgentPermissionKey[];
  grantedTools: string[];
  /** Permission- and approval-gated tool execution. */
  callTool(key: string, input?: Record<string, unknown>): Promise<ToolCallResult>;
  log(message: string, meta?: Record<string, unknown>): void;
  addUsage(usage: Partial<TokenUsage>): void;
  /** Set by the runtime when a human decision is required. */
  requestApproval(action: string, reason: string, payload?: Record<string, unknown>): Promise<string | null>;
  /** Ambient context (page, room, product being viewed…). */
  context: Record<string, unknown>;
}

export interface HandlerResult {
  output: Record<string, unknown>;
  dataState?: "ok" | "no_data" | "not_enough_data" | "degraded";
  /** Set when the handler needs a human decision before finishing. */
  approvalId?: string;
}

export type AgentHandler = (input: Record<string, unknown>, ctx: HandlerContext) => Promise<HandlerResult>;

export const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;

export const num = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};
