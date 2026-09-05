// ============================================================
// /api/automation/agents/[key] — read / update / delete one agent (admin)
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { getAgent, updateAgent, deleteAgent, agentRunMeta, AGENT_STATUSES, AGENT_TYPES, AGENT_RUNTIMES } from "@/services/agents/registry";
import { listExecutionLogs } from "@/services/automation/executionLog";
import { HANDLER_KEYS } from "@/services/agents/handlers";
import type { AgentPatch } from "@/services/agents/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/i;

async function readKey(params: Promise<{ key: string }>) {
  const { key } = await params;
  const clean = decodeURIComponent(key).trim();
  if (!KEY_RE.test(clean)) throw ApiError.badRequest("کلید ایجنت نامعتبر است");
  return clean;
}

export const GET = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  await requireAdminUser(req);
  const key = await readKey(params);
  const agent = await getAgent(key);
  if (!agent) throw ApiError.notFound(`ایجنت «${key}» پیدا نشد`);
  const runs = await listExecutionLogs({ agentKey: agent.key, limit: 25 });
  const meta = await agentRunMeta(agent);
  return ok({ agent: { ...agent, ...meta }, runs, lastRunAt: meta.lastRunAt, nextRunAt: meta.nextRunAt });
});

export const PATCH = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const { user } = await requireAdminUser(req);
  const key = await readKey(params);
  const body = (await readBody(req, 100_000)) as Record<string, unknown>;
  const patch: AgentPatch = {};

  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 160);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 2000);
  if (typeof body.type === "string") {
    if (!AGENT_TYPES.includes(body.type as never)) throw ApiError.badRequest("type نامعتبر است");
    patch.type = body.type as never;
  }
  if (typeof body.status === "string") {
    if (!AGENT_STATUSES.includes(body.status as never)) throw ApiError.badRequest("status نامعتبر است");
    patch.status = body.status as never;
  }
  if (typeof body.runtime === "string") {
    if (!AGENT_RUNTIMES.includes(body.runtime as never)) throw ApiError.badRequest("runtime نامعتبر است");
    patch.runtime = body.runtime as never;
  }
  if (body.handler !== undefined) {
    const handler = body.handler === null || body.handler === "" ? null : String(body.handler);
    if (handler && !HANDLER_KEYS.includes(handler)) throw ApiError.badRequest("handler نامعتبر است");
    patch.handler = handler;
  }
  if (typeof body.systemPrompt === "string") patch.systemPrompt = body.systemPrompt.slice(0, 8000);
  if (typeof body.model === "string") patch.model = body.model.slice(0, 120);
  if (body.config && typeof body.config === "object") patch.config = body.config as Record<string, unknown>;
  if (body.schedule !== undefined) patch.schedule = (body.schedule ?? null) as AgentPatch["schedule"];
  if (typeof body.maxRetries === "number") patch.maxRetries = Math.min(5, Math.max(0, Math.round(body.maxRetries)));
  if (typeof body.timeoutMs === "number") patch.timeoutMs = Math.min(180_000, Math.max(1000, Math.round(body.timeoutMs)));
  if (typeof body.maxCostMicro === "number") patch.maxCostMicro = Math.max(0, Math.round(body.maxCostMicro));
  if (Array.isArray(body.tools)) patch.tools = body.tools.filter((t): t is string => typeof t === "string").slice(0, 60);
  if (Array.isArray(body.permissions)) patch.permissions = body.permissions.filter((p): p is string => typeof p === "string").slice(0, 40) as never;

  if (!Object.keys(patch).length) throw ApiError.badRequest("هیچ فیلد قابل بروزرسانی ارسال نشد");

  try {
    const agent = await updateAgent(key, patch, user.id);
    if (!agent) throw ApiError.notFound(`ایجنت «${key}» پیدا نشد`);
    return ok({ agent });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest(error instanceof Error ? error.message : "بروزرسانی ناموفق بود");
  }
});

export const DELETE = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  await requireAdminUser(req);
  const key = await readKey(params);
  const agent = await getAgent(key);
  if (!agent) throw ApiError.notFound(`ایجنت «${key}» پیدا نشد`);
  if (agent.isBuiltin) throw ApiError.forbidden("ایجنت‌های داخلی را نمی‌توان حذف کرد — می‌توانی غیرفعالش کنی");
  const deleted = await deleteAgent(key);
  return ok({ deleted, key });
});
