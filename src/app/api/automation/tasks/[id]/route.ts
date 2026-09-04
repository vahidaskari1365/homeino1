// ============================================================
// /api/automation/tasks/[id] — one task: read, retry, cancel, run
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { getTaskWithLogs, retryTask, cancelTask, runTask } from "@/services/automation/taskQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^[0-9a-fA-F-]{1,64}$/;

async function readId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const clean = decodeURIComponent(id).trim();
  if (!ID_RE.test(clean)) throw ApiError.badRequest("شناسه وظیفه نامعتبر است");
  return clean;
}

export const GET = guard(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdminUser(req);
  const id = await readId(params);
  const { task, logs } = await getTaskWithLogs(id);
  if (!task) throw ApiError.notFound("وظیفه پیدا نشد");
  return ok({ task, logs });
});

export const PATCH = guard(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireAdminUser(req);
  const id = await readId(params);
  const body = (await readBody(req, 50_000)) as Record<string, unknown>;
  const action = String(body.action ?? "retry");

  const { task } = await getTaskWithLogs(id);
  if (!task) throw ApiError.notFound("وظیفه پیدا نشد");

  if (action === "cancel") {
    const cancelled = await cancelTask(id, user.id, typeof body.reason === "string" ? body.reason.slice(0, 200) : undefined);
    return ok({ id, cancelled, status: cancelled ? "cancelled" : task.status });
  }
  if (action === "run") {
    const result = await runTask(id);
    return ok({ id, ...result });
  }
  if (action === "retry") {
    const result = await retryTask(id, user.id);
    return ok({ id, ...result });
  }
  throw ApiError.badRequest("action باید یکی از retry / run / cancel باشد");
});
