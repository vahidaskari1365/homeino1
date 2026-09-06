// ============================================================
// /api/automation/tasks — Task Queue (admin / vendor assignees)
//   GET  ?status=&agentKey=&limit= → queue + summary
//   POST { title, type?, agentKey?, payload?, assigneeRole?, priority? }
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireAdminUser } from "@/lib/api/auth";
import { listTasks, createTask, taskQueueSummary } from "@/services/automation/taskQueue";
import type { TaskStatus } from "@/services/agents/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: TaskStatus[] = ["pending", "running", "completed", "failed", "waiting_approval", "cancelled"];

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && STATUSES.includes(statusParam as TaskStatus) ? (statusParam as TaskStatus) : undefined;
  const agentKey = url.searchParams.get("agentKey")?.slice(0, 80) ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  const [items, summary] = await Promise.all([listTasks({ status, agentKey, limit }), taskQueueSummary()]);
  return ok({ items, count: items.length, summary, dataState: items.length ? "ok" : "no_data" });
});

export const POST = guard(async (req) => {
  const { user } = await requireAdminUser(req);
  await rateLimit(`tasks:create:${user.id}`, { windowMs: 60_000, max: 30 });
  const body = (await readBody(req, 100_000)) as Record<string, unknown>;

  const title = String(body.title ?? "").trim();
  if (!title) throw ApiError.badRequest("عنوان وظیفه الزامی است");

  const id = await createTask({
    title: title.slice(0, 200),
    type: typeof body.type === "string" ? body.type.slice(0, 40) : "manual",
    priority: typeof body.priority === "number" ? Math.min(100, Math.max(0, Math.round(body.priority))) : 0,
    agentKey: typeof body.agentKey === "string" ? body.agentKey.slice(0, 80) : null,
    userId: typeof body.userId === "string" ? body.userId.slice(0, 64) : null,
    vendorId: typeof body.vendorId === "string" ? body.vendorId.slice(0, 64) : null,
    productId: typeof body.productId === "string" ? body.productId.slice(0, 64) : null,
    payload: (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>,
    assigneeRole: typeof body.assigneeRole === "string" ? body.assigneeRole.slice(0, 30) : "admin",
    maxAttempts: typeof body.maxAttempts === "number" ? Math.min(10, Math.max(1, Math.round(body.maxAttempts))) : 3,
    dueAt: typeof body.dueAt === "string" ? body.dueAt.slice(0, 40) : null,
    createdBy: user.id,
  });

  return ok({ id, title }, { status: 201 });
});
