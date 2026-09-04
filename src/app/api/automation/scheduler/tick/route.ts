// ============================================================
// /api/automation/scheduler/tick — cron entry point
//
// Vercel Cron / any external cron POSTs here with `Authorization: Bearer
// $CRON_SECRET`. An authenticated admin may also trigger it manually.
//
// GET returns the schedule status (admin only) — what is due, what is next.
// ============================================================
import { timingSafeEqual } from "crypto";
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { tickScheduler, scheduleStatus } from "@/services/workflows/scheduler";
import { expireStaleApprovals } from "@/services/automation/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Compare against a same-length buffer so the timing still does not leak length.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export const POST = guard(async (req) => {
  if (!isAuthorizedCron(req)) await requireAdminUser(req);
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 10) || 10));

  const [tick, expiredApprovals] = await Promise.all([tickScheduler({ force, limit }), expireStaleApprovals()]);
  return ok({ ...tick, expiredApprovals });
});

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  return ok(await scheduleStatus());
});
