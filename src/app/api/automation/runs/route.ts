// ============================================================
// /api/automation/runs — workflow execution history (admin)
//   GET ?workflowKey=&status=&limit=        → run rows
//   GET ?runId=<id>                         → one run + its step records
// ============================================================
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { listWorkflowRuns } from "@/services/automation/executionLog";
import { getStore } from "@/services/agents/store";
import type { RunStatus } from "@/services/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: RunStatus[] = ["queued", "running", "completed", "failed", "cancelled", "waiting_approval"];

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId")?.slice(0, 64) ?? null;
  const store = await getStore();

  if (runId) {
    const run = await store.getRun(runId);
    if (!run) return ok({ run: null, steps: [], dataState: "no_data" });
    const steps = await store.listSteps(runId);
    return ok({ run, steps, dataState: "ok" });
  }

  const workflowKey = url.searchParams.get("workflowKey")?.slice(0, 80) ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam && STATUSES.includes(statusParam as RunStatus) ? (statusParam as RunStatus) : undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  const runs = await listWorkflowRuns({ workflowKey, status, limit });
  return ok({ items: runs, count: runs.length, dataState: runs.length ? "ok" : "no_data" });
});
