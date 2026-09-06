// ============================================================
// /api/automation/workflows/[key]/run — manual run + approval resume (admin)
//
//   POST { triggerPayload?, input?, userId?, sessionId? }        → run now
//   POST { action: "resume", runId, decision: approved|rejected } → continue a
//        run that paused on a Human Approval node
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireAdminUser } from "@/lib/api/auth";
import { getWorkflow } from "@/services/workflows/registry";
import { executeWorkflowByKey, resumeWorkflowRun } from "@/services/workflows/engine";
import { listWorkflowRuns } from "@/services/automation/executionLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/i;

export const POST = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const { user } = await requireAdminUser(req);
  await rateLimit(`workflows:run:${user.id}`, { windowMs: 60_000, max: 30 });

  const { key } = await params;
  const workflowKey = decodeURIComponent(key).trim();
  if (!KEY_RE.test(workflowKey)) throw ApiError.badRequest("کلید ورک‌فلو نامعتبر است");

  const workflow = await getWorkflow(workflowKey);
  if (!workflow) throw ApiError.notFound(`ورک‌فلو «${workflowKey}» پیدا نشد`);

  const body = (await readBody(req, 200_000)) as Record<string, unknown>;

  if (String(body.action ?? "") === "resume") {
    const runId = String(body.runId ?? "").slice(0, 64);
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    if (!runId) throw ApiError.badRequest("runId الزامی است");
    const result = await resumeWorkflowRun(runId, decision, user.id);
    if (!result) throw ApiError.notFound("اجرای منتظر تأیید پیدا نشد");
    return ok(result);
  }

  const result = await executeWorkflowByKey(workflowKey, {
    triggerKind: "manual",
    triggerPayload: (body.triggerPayload && typeof body.triggerPayload === "object" ? body.triggerPayload : {}) as Record<string, unknown>,
    input: (body.input && typeof body.input === "object" ? body.input : {}) as Record<string, unknown>,
    userId: typeof body.userId === "string" ? body.userId.slice(0, 64) : null,
    sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 80) : null,
    actorRole: "admin",
    actorId: user.id,
  });

  const runs = await listWorkflowRuns({ workflowKey, limit: 5 });
  return ok({ result, recentRuns: runs });
});
