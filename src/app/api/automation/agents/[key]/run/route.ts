// ============================================================
// /api/automation/agents/[key]/run — execute one agent (admin)
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireAdminUser } from "@/lib/api/auth";
import { runAgentByKey, cancelAgentRun } from "@/services/agents/runtime";
import { getAgent } from "@/services/agents/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/i;

export const POST = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const { user } = await requireAdminUser(req);
  rateLimit(`agents:run:${user.id}`, { windowMs: 60_000, max: 30 });

  const { key } = await params;
  const agentKey = decodeURIComponent(key).trim();
  if (!KEY_RE.test(agentKey)) throw ApiError.badRequest("کلید ایجنت نامعتبر است");

  const agent = await getAgent(agentKey);
  if (!agent) throw ApiError.notFound(`ایجنت «${agentKey}» پیدا نشد`);

  const body = (await readBody(req, 200_000)) as Record<string, unknown>;
  const input = (body.input && typeof body.input === "object" ? body.input : {}) as Record<string, unknown>;

  if (body.cancel === true) {
    cancelAgentRun(String(body.runId ?? agentKey));
    return ok({ cancelled: true, agentKey });
  }

  const result = await runAgentByKey(agentKey, {
    input,
    userId: typeof body.userId === "string" ? body.userId.slice(0, 64) : null,
    sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 80) : null,
    taskId: typeof body.taskId === "string" ? body.taskId.slice(0, 64) : null,
    triggeredBy: `admin:${user.id}`,
  });

  if (result.status === "waiting_approval") {
    return ok({ ...result, message: "این اجرا منتظر تأیید انسانی است" }, { status: 202 });
  }
  if (!result.ok) {
    // Honest failure — the caller gets the real error and the log id.
    return ok({ ...result }, { status: 200 });
  }
  return ok(result);
});
