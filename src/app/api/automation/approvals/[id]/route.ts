// ============================================================
// /api/automation/approvals/[id] — decide one approval (admin)
//
// POST { decision: "approved" | "rejected", note? }
//   • approved → the guarded action executes (real DB write / HTTP / browser)
//   • if the approval paused a workflow run, that run is resumed
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireAdminUser } from "@/lib/api/auth";
import { decideApproval, getApproval } from "@/services/automation/approvals";
import { resumeWorkflowRun } from "@/services/workflows/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-fA-F-]{1,64}$/;

export const POST = guard(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAdminUser(req);
  await rateLimit(`approvals:${user.id}`, { windowMs: 60_000, max: 60 });

  const { id } = await params;
  const approvalId = decodeURIComponent(id).trim();
  if (!ID_RE.test(approvalId)) throw ApiError.badRequest("شناسه تأیید نامعتبر است");

  const approval = await getApproval(approvalId);
  if (!approval) throw ApiError.notFound("درخواست تأیید پیدا نشد");
  if (approval.status !== "pending") throw ApiError.conflict(`این درخواست قبلاً ${approval.status} شده است`);

  const body = (await readBody(req, 50_000)) as Record<string, unknown>;
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : null;
  if (!decision) throw ApiError.badRequest('decision باید "approved" یا "rejected" باشد');
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;

  const result = await decideApproval({ approvalId, decision, decidedBy: user.id, note });
  if (!result.ok) throw ApiError.badRequest(result.error ?? "تصمیم ثبت نشد");

  // Resume the paused workflow run (if this approval came from one).
  let resumed = null;
  if (approval.runId && body.resumeWorkflow !== false) {
    try {
      resumed = await resumeWorkflowRun(approval.runId, decision, user.id);
    } catch {
      resumed = null;
    }
  }

  return ok({ approval: result.approval, executed: Boolean(result.executed), result: result.result ?? null, error: result.error ?? null, resumed });
});
