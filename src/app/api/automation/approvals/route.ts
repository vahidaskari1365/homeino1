// ============================================================
// /api/automation/approvals — Human Approval queue (admin)
//   GET ?status=pending → items awaiting a human decision
// ============================================================
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { listApprovals, expireStaleApprovals } from "@/services/automation/approvals";
import type { ApprovalStatus } from "@/services/agents/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected", "expired"];

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && STATUSES.includes(statusParam as ApprovalStatus) ? (statusParam as ApprovalStatus) : "pending";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  // Expired requests must not sit in the queue pretending to be actionable.
  const expired = await expireStaleApprovals();
  const items = await listApprovals({ status, limit });
  return ok({ items, count: items.length, expiredNow: expired, dataState: items.length ? "ok" : "no_data" });
});
