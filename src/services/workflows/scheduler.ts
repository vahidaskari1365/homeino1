// ============================================================
// HOMEINO — WORKFLOW SCHEDULER
//
// Two ways to drive scheduled workflows:
//   1. tickScheduler()  — called by POST /api/automation/scheduler/tick from a
//      cron (Vercel Cron / external cron). Safe to call often: it only runs
//      workflows whose nextRunAt has passed and advances them afterwards.
//   2. startScheduler() — in-process interval for long-lived Node deployments.
//
// No workflow ever runs "just because": a schedule without a nextRunAt is
// initialised first, so a freshly activated daily workflow waits for its slot.
// ============================================================
import type { WorkflowDefinition } from "../agents/types";
import { getStore } from "../agents/store";
import { executeWorkflowByKey, nextScheduleRun } from "./engine";

export interface SchedulerTickResult {
  tickedAt: string;
  dueCount: number;
  initialisedCount: number;
  ran: { key: string; runId: string | null; ok: boolean; status?: string; error?: string; nextRunAt: string | null }[];
  dataState: "ok" | "no_data";
}

export async function listDueWorkflows(now = new Date()): Promise<WorkflowDefinition[]> {
  const store = await getStore();
  const workflows = await store.listWorkflows();
  return workflows.filter((workflow) => {
    if (workflow.status !== "active") return false;
    if (workflow.triggerKind !== "schedule") return false;
    return workflow.nextRunAt != null && new Date(workflow.nextRunAt).getTime() <= now.getTime();
  });
}

export async function tickScheduler(options: { limit?: number; force?: boolean } = {}): Promise<SchedulerTickResult> {
  const now = new Date();
  const store = await getStore();
  const workflows = await store.listWorkflows();
  const result: SchedulerTickResult = { tickedAt: now.toISOString(), dueCount: 0, initialisedCount: 0, ran: [], dataState: "no_data" };

  // 1) Give schedule-triggered workflows a nextRunAt if they don't have one.
  for (const workflow of workflows) {
    if (workflow.triggerKind !== "schedule" || workflow.status !== "active") continue;
    if (workflow.nextRunAt) continue;
    const next = nextScheduleRun(workflow.schedule, now);
    await store.updateWorkflow(workflow.key, { nextRunAt: next.toISOString() });
    workflow.nextRunAt = next.toISOString();
    result.initialisedCount += 1;
  }

  // 2) Run everything that is due.
  const due = options.force
    ? workflows.filter((w) => w.triggerKind === "schedule" && w.status === "active")
    : workflows.filter((w) => w.triggerKind === "schedule" && w.status === "active" && w.nextRunAt && new Date(w.nextRunAt).getTime() <= now.getTime());

  result.dueCount = due.length;
  if (!due.length) return result;
  result.dataState = "ok";

  for (const workflow of due.slice(0, Math.max(1, options.limit ?? 10))) {
    let runId: string | null = null;
    let ok = false;
    let status: string | undefined;
    let error: string | undefined;
    try {
      const run = await executeWorkflowByKey(workflow.key, {
        triggerKind: "schedule",
        triggerPayload: { scheduledFor: workflow.nextRunAt ?? now.toISOString() },
        actorRole: "system",
      });
      runId = run.runId ?? null;
      ok = run.ok;
      status = run.status;
      error = run.error;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const next = nextScheduleRun(workflow.schedule, now);
    await store.updateWorkflow(workflow.key, { nextRunAt: next.toISOString(), lastRunAt: now.toISOString() });
    result.ran.push({ key: workflow.key, runId, ok, status, error, nextRunAt: next.toISOString() });
  }

  return result;
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

/** Long-lived Node deployments only — a no-op on serverless (use the tick API). */
export function startScheduler(intervalMs = 60_000): { stop: () => void } | null {
  if (process.env.HOMEINO_SCHEDULER_DISABLED === "true" || process.env.VERCEL === "1") return null;
  if (schedulerHandle) return { stop: () => stopScheduler() };
  schedulerHandle = setInterval(() => {
    void tickScheduler().catch((error) => {
      console.warn("[scheduler] tick failed:", (error as Error).message);
    });
  }, Math.max(10_000, intervalMs));
  // Never keep the process alive just for the scheduler.
  schedulerHandle.unref?.();
  return { stop: () => stopScheduler() };
}

export function stopScheduler() {
  if (schedulerHandle) clearInterval(schedulerHandle);
  schedulerHandle = null;
}

export async function scheduleStatus() {
  const store = await getStore();
  const workflows = await store.listWorkflows();
  const scheduled = workflows.filter((w) => w.triggerKind === "schedule");
  return {
    running: Boolean(schedulerHandle),
    disabled: process.env.HOMEINO_SCHEDULER_DISABLED === "true" || process.env.VERCEL === "1",
    scheduledWorkflows: scheduled.map((w) => ({
      key: w.key,
      name: w.name,
      status: w.status,
      schedule: w.schedule,
      nextRunAt: w.nextRunAt,
      lastRunAt: w.lastRunAt,
    })),
  };
}
