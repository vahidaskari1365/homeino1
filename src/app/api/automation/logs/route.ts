// ============================================================
// /api/automation/logs — agent execution log + cost/quality summary (admin)
// ============================================================
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { listExecutionLogs, executionSummary } from "@/services/automation/executionLog";
import type { RunStatus } from "@/services/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: RunStatus[] = ["queued", "running", "completed", "failed", "cancelled", "waiting_approval"];

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const agentKey = url.searchParams.get("agentKey")?.slice(0, 80) ?? undefined;
  const runId = url.searchParams.get("runId")?.slice(0, 64) ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam && STATUSES.includes(statusParam as RunStatus) ? (statusParam as RunStatus) : undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 7) || 7));

  const [items, summary] = await Promise.all([listExecutionLogs({ agentKey, runId, status, limit }), executionSummary(days)]);
  return ok({ items, count: items.length, summary, dataState: items.length ? "ok" : "no_data" });
});
