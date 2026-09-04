// ============================================================
// /api/automation/status — one honest snapshot of the agentic core (admin)
// ============================================================
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { orchestratorStatus } from "@/services/agents/orchestrator";
import { executionSummary } from "@/services/automation/executionLog";
import { taskQueueSummary } from "@/services/automation/taskQueue";
import { listApprovals } from "@/services/automation/approvals";
import { getBudgetStatus, budgets } from "@/services/automation/costControl";
import { scheduleStatus } from "@/services/workflows/scheduler";
import { eventStats } from "@/services/workflows/triggers";
import { getStore } from "@/services/agents/store";
import { allowedDomains } from "@/services/agents/integrations/httpRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const store = await getStore();

  const [status, executions, tasks, approvals, budgetStatus, budgetRows, schedule, events, integrations] = await Promise.all([
    orchestratorStatus(),
    executionSummary(7),
    taskQueueSummary(),
    listApprovals({ status: "pending", limit: 100 }),
    getBudgetStatus(),
    budgets(),
    scheduleStatus(),
    eventStats(24),
    store.listIntegrations(),
  ]);

  return ok({
    ...status,
    executions,
    tasks,
    pendingApprovals: approvals,
    budgets: { items: budgetRows, status: budgetStatus },
    schedule,
    events,
    integrations,
    httpAllowlist: allowedDomains(),
  });
});
