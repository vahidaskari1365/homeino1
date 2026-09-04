// ============================================================
// HOMEINO — AGENT REGISTRY
//
// Agents are data, not code. The registry stores them (Supabase when
// configured, in-process otherwise) and validates everything an admin submits:
// unknown tools and permissions are dropped, never silently accepted.
// ============================================================
import type { AgentDefinition, AgentSchedule, AgentStatus, AgentType } from "./types";
import type { AgentPatch, NewAgentInput, ToolRecord } from "./store/types";
import { ensureSeeded, getStore, storeMode, storeModeReason } from "./store";
import { AGENT_PERMISSIONS, PERMISSION_LABELS, PERMISSION_RISK, normalizePermissions, type AgentPermissionKey } from "./permissions";
import { BUILTIN_TOOLS } from "./defaults";
import { HANDLER_KEYS } from "./handlers";
import { listToolDefinitions } from "./tools";
import { browserProviderStatus } from "./integrations/browserRuntime";
import { llmStatus } from "./llmGateway";
import { customerMemory } from "../memory/customerMemory";

export const AGENT_TYPES: AgentType[] = ["analyzer", "generator", "executor", "assistant", "browser", "notifier"];
export const AGENT_STATUSES: AgentStatus[] = ["draft", "active", "paused", "archived"];
export const AGENT_RUNTIMES: AgentDefinition["runtime"][] = ["local", "dify", "langflow", "ollama"];

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAgentInput(input: Partial<NewAgentInput> & { key?: string }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const knownTools = new Set(BUILTIN_TOOLS.map((t) => t.key));

  if (input.key !== undefined && !KEY_RE.test(input.key)) {
    errors.push("کلید ایجنت باید با حروف کوچک لاتین/عدد شروع شود و فقط شامل a-z 0-9 - _ باشد (۲ تا ۸۰ کاراکتر)");
  }
  if (input.name !== undefined && (!input.name.trim() || input.name.length > 160)) {
    errors.push("نام ایجنت الزامی است (حداکثر ۱۶۰ کاراکتر)");
  }
  if (input.type !== undefined && !AGENT_TYPES.includes(input.type)) errors.push(`نوع ایجنت باید یکی از ${AGENT_TYPES.join(", ")} باشد`);
  if (input.status !== undefined && !AGENT_STATUSES.includes(input.status)) errors.push(`وضعیت باید یکی از ${AGENT_STATUSES.join(", ")} باشد`);
  if (input.runtime !== undefined && !AGENT_RUNTIMES.includes(input.runtime)) errors.push(`runtime باید یکی از ${AGENT_RUNTIMES.join(", ")} باشد`);
  if (input.handler && !HANDLER_KEYS.includes(input.handler)) {
    warnings.push(`هندلر «${input.handler}» شناخته‌شده نیست — ایجنت به‌صورت declarative اجرا می‌شود`);
  }
  if (input.maxRetries !== undefined && (input.maxRetries < 0 || input.maxRetries > 5)) errors.push("maxRetries باید بین ۰ و ۵ باشد");
  if (input.timeoutMs !== undefined && (input.timeoutMs < 1000 || input.timeoutMs > 180000)) errors.push("timeoutMs باید بین ۱۰۰۰ و ۱۸۰۰۰۰ باشد");

  const tools = input.tools ?? [];
  const unknownTools = tools.filter((t) => !knownTools.has(t));
  if (unknownTools.length) warnings.push(`ابزارهای ناشناخته نادیده گرفته شدند: ${unknownTools.join(", ")}`);

  const permissions = normalizePermissions(input.permissions ?? []);
  const droppedPermissions = (input.permissions ?? []).filter((p) => !permissions.includes(p as AgentPermissionKey));
  if (droppedPermissions.length) warnings.push(`مجوزهای نامعتبر نادیده گرفته شدند: ${droppedPermissions.join(", ")}`);

  const grantedTools = tools.filter((t) => knownTools.has(t));
  const missingPermissions = grantedTools
    .map((key) => BUILTIN_TOOLS.find((t) => t.key === key)?.requiredPermission)
    .filter((p): p is AgentPermissionKey => Boolean(p) && !permissions.includes(p as AgentPermissionKey));
  if (missingPermissions.length) {
    warnings.push(`ابزارهای زیر بدون مجوز لازم کار نمی‌کنند: ${[...new Set(missingPermissions)].join(", ")}`);
  }

  return { ok: !errors.length, errors, warnings };
}

export function sanitizeAgentInput(input: Partial<NewAgentInput>): Partial<NewAgentInput> {
  const knownTools = new Set(BUILTIN_TOOLS.map((t) => t.key));
  return {
    ...input,
    key: input.key?.trim().toLowerCase(),
    name: input.name?.trim(),
    tools: [...new Set((input.tools ?? []).filter((t) => knownTools.has(t)))],
    permissions: normalizePermissions(input.permissions ?? []),
    schedule: sanitizeSchedule(input.schedule),
  };
}

export function sanitizeSchedule(schedule: unknown): AgentSchedule | null {
  if (!schedule || typeof schedule !== "object") return null;
  const raw = schedule as Record<string, unknown>;
  const kind = String(raw.kind ?? "manual");
  if (!["manual", "interval", "daily", "weekly", "cron"].includes(kind)) return { kind: "manual" };
  const out: AgentSchedule = { kind: kind as AgentSchedule["kind"] };
  if (typeof raw.everyMinutes === "number" && raw.everyMinutes >= 1) out.everyMinutes = Math.min(10080, Math.round(raw.everyMinutes));
  if (typeof raw.at === "string" && /^\d{1,2}:\d{2}$/.test(raw.at)) out.at = raw.at;
  if (typeof raw.weekday === "number" && raw.weekday >= 0 && raw.weekday <= 6) out.weekday = raw.weekday;
  if (typeof raw.weekday === "string") out.weekday = raw.weekday;
  if (typeof raw.cron === "string" && raw.cron.length <= 120) out.cron = raw.cron;
  if (typeof raw.timezone === "string") out.timezone = raw.timezone.slice(0, 64);
  return out;
}

export async function listAgents(): Promise<AgentDefinition[]> {
  const store = await ensureSeeded();
  return store.listAgents();
}

export async function getAgent(keyOrId: string): Promise<AgentDefinition | null> {
  const store = await ensureSeeded();
  return store.getAgent(keyOrId);
}

export async function createAgent(input: NewAgentInput, actorId?: string | null): Promise<AgentDefinition> {
  const store = await ensureSeeded();
  const validation = validateAgentInput(input);
  if (!validation.ok) throw new Error(validation.errors.join(" · "));
  const clean = sanitizeAgentInput(input);
  const existing = await store.getAgent(clean.key!);
  if (existing) throw new Error(`کلید ایجنت «${clean.key}» قبلاً استفاده شده است`);
  return store.createAgent({
    ...(input as NewAgentInput),
    ...clean,
    status: clean.status ?? "draft",
    createdBy: actorId ?? null,
  } as NewAgentInput);
}

export async function updateAgent(keyOrId: string, patch: AgentPatch, actorId?: string | null): Promise<AgentDefinition | null> {
  const store = await ensureSeeded();
  const agent = await store.getAgent(keyOrId);
  if (!agent) return null;
  const validation = validateAgentInput({ ...agent, ...patch } as Partial<NewAgentInput>);
  if (!validation.ok) throw new Error(validation.errors.join(" · "));
  const clean = sanitizeAgentInput(patch as Partial<NewAgentInput>) as AgentPatch;
  void actorId;
  return store.updateAgent(keyOrId, clean);
}

export async function deleteAgent(keyOrId: string): Promise<boolean> {
  const store = await ensureSeeded();
  return store.deleteAgent(keyOrId);
}

export async function setAgentStatus(keyOrId: string, status: AgentStatus): Promise<AgentDefinition | null> {
  const store = await ensureSeeded();
  return store.updateAgent(keyOrId, { status });
}

export async function listToolRegistry(): Promise<ToolRecord[]> {
  const store = await ensureSeeded();
  const stored = await store.listTools();
  if (stored.length) return stored;
  // Nothing persisted yet (e.g. migration not applied) — expose the code registry.
  return listToolDefinitions().map((tool) => ({
    key: tool.key,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    requiredPermission: tool.requiredPermission,
    requiresApproval: Boolean(tool.requiresApproval),
    isDestructive: Boolean(tool.isDestructive),
    inputSchema: tool.inputSchema,
    isActive: true,
    isBuiltin: true,
  }));
}

/** Everything the admin UI needs to build an agent form. */
export async function agentRegistryMeta() {
  const [tools, agents] = await Promise.all([listToolRegistry(), listAgents()]);
  return {
    storeMode: storeMode(),
    storeReason: storeModeReason(),
    types: AGENT_TYPES,
    statuses: AGENT_STATUSES,
    runtimes: AGENT_RUNTIMES,
    handlers: HANDLER_KEYS,
    permissions: AGENT_PERMISSIONS.map((key) => ({ key, label: PERMISSION_LABELS[key], risk: PERMISSION_RISK[key] })),
    tools,
    agents: agents.map((a) => ({ key: a.key, name: a.name, status: a.status, isBuiltin: Boolean(a.isBuiltin) })),
    llm: llmStatus(),
    browser: browserProviderStatus(),
    memory: customerMemory.status(),
  };
}
