// ============================================================
// /api/automation/agents — Agent Registry (admin)
//   GET  list agents + everything the builder form needs
//   POST create an agent (tools/permissions validated server-side)
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireAdminUser } from "@/lib/api/auth";
import { listAgents, createAgent, agentRegistryMeta, validateAgentInput, agentRunMeta } from "@/services/agents/registry";
import { AGENT_STATUSES, AGENT_TYPES, AGENT_RUNTIMES } from "@/services/agents/registry";
import { HANDLER_KEYS } from "@/services/agents/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const [agents, meta] = await Promise.all([listAgents(), agentRegistryMeta()]);
  const status = url.searchParams.get("status");
  const filtered = status && AGENT_STATUSES.includes(status as never) ? agents.filter((a) => a.status === status) : agents;
  const items = await Promise.all(filtered.map(async (agent) => ({ ...agent, ...(await agentRunMeta(agent)) })));
  return ok({ items, meta });
});

export const POST = guard(async (req) => {
  const { user } = await requireAdminUser(req);
  await rateLimit(`agents:create:${user.id}`, { windowMs: 60_000, max: 20 });
  const body = (await readBody(req, 100_000)) as Record<string, unknown>;

  const key = String(body.key ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  if (!key || !name) throw ApiError.badRequest("key و name الزامی هستند");

  const type = String(body.type ?? "executor");
  if (!AGENT_TYPES.includes(type as never)) throw ApiError.badRequest("type نامعتبر است");
  const status = String(body.status ?? "draft");
  if (!AGENT_STATUSES.includes(status as never)) throw ApiError.badRequest("status نامعتبر است");
  const runtime = String(body.runtime ?? "local");
  if (!AGENT_RUNTIMES.includes(runtime as never)) throw ApiError.badRequest("runtime نامعتبر است");
  const handler = body.handler === undefined || body.handler === null || body.handler === "" ? null : String(body.handler);
  if (handler && !HANDLER_KEYS.includes(handler)) throw ApiError.badRequest(`handler باید یکی از ${HANDLER_KEYS.join(", ")} باشد`);

  const tools = Array.isArray(body.tools) ? body.tools.filter((t): t is string => typeof t === "string").slice(0, 60) : [];
  const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p): p is string => typeof p === "string").slice(0, 40) : [];

  const validation = validateAgentInput({
    key,
    name,
    tools,
    permissions: permissions as never,
    maxRetries: typeof body.maxRetries === "number" ? body.maxRetries : undefined,
    timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
  });
  if (!validation.ok) throw ApiError.badRequest(validation.errors.join(" · "));

  try {
    const agent = await createAgent(
      {
        key,
        name,
        description: typeof body.description === "string" ? body.description.slice(0, 2000) : undefined,
        type: type as never,
        status: status as never,
        runtime: runtime as never,
        handler: handler ?? undefined,
        systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt.slice(0, 8000) : undefined,
        tools,
        permissions: permissions as never,
        config: (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>,
        maxRetries: typeof body.maxRetries === "number" ? Math.min(5, Math.max(0, Math.round(body.maxRetries))) : 1,
        timeoutMs: typeof body.timeoutMs === "number" ? Math.min(180_000, Math.max(1000, Math.round(body.timeoutMs))) : 30_000,
        maxCostMicro: typeof body.maxCostMicro === "number" ? Math.max(0, Math.round(body.maxCostMicro)) : undefined,
      },
      user.id,
    );
    return ok({ agent, warnings: validation.warnings }, { status: 201 });
  } catch (error) {
    console.error("[automation]", error);
    throw ApiError.conflict("ساخت ایجنت ناموفق بود");
  }
});
