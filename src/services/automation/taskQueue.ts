// ============================================================
// HOMEINO — AGENT TASK QUEUE
//
// Every task an agent creates lands here and is visible in the admin panel:
//   pending · running · completed · failed · waiting_approval · cancelled
// with retry / cancel / logs.
// ============================================================
import { getStore } from "../agents/store";
import type { TaskRecord, TaskLogRecord, TaskStatus } from "../agents/store/types";
import { runAgentByKey } from "../agents/runtime";

export interface CreateTaskInput {
  title: string;
  type?: string;
  priority?: number;
  agentKey?: string | null;
  workflowRunId?: string | null;
  userId?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  payload?: Record<string, unknown>;
  assigneeRole?: string;
  maxAttempts?: number;
  dueAt?: string | null;
  status?: TaskStatus;
  createdBy?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<string> {
  const store = await getStore();
  const taskId = await store.createTask(input);
  await store.addTaskLog(taskId, "info", "وظیفه ایجاد شد", { type: input.type ?? "generic", agentKey: input.agentKey ?? null });
  return taskId;
}

export async function listTasks(filter?: { status?: TaskStatus; agentKey?: string; limit?: number }): Promise<TaskRecord[]> {
  const store = await getStore();
  return store.listTasks(filter);
}

export async function getTask(id: string): Promise<TaskRecord | null> {
  const store = await getStore();
  return store.getTask(id);
}

export async function getTaskWithLogs(id: string): Promise<{ task: TaskRecord | null; logs: TaskLogRecord[] }> {
  const store = await getStore();
  const [task, logs] = await Promise.all([store.getTask(id), store.listTaskLogs(id)]);
  return { task, logs };
}

export async function markTaskRunning(id: string): Promise<void> {
  const store = await getStore();
  await store.updateTask(id, { status: "running", startedAt: new Date().toISOString() });
  await store.addTaskLog(id, "info", "اجرای وظیفه آغاز شد");
}

export async function completeTask(id: string, result: Record<string, unknown>): Promise<void> {
  const store = await getStore();
  await store.updateTask(id, { status: "completed", result, completedAt: new Date().toISOString(), error: null });
  await store.addTaskLog(id, "info", "وظیفه با موفقیت کامل شد", { resultKeys: Object.keys(result) });
}

export async function failTask(id: string, error: string): Promise<void> {
  const store = await getStore();
  const task = await store.getTask(id);
  const attempt = (task?.attempt ?? 0) + 1;
  const exhausted = attempt >= (task?.maxAttempts ?? 3);
  await store.updateTask(id, { status: exhausted ? "failed" : "pending", attempt, error });
  await store.addTaskLog(id, exhausted ? "error" : "warn", exhausted ? `وظیفه پس از ${attempt} تلاش شکست خورد` : `تلاش ${attempt} ناموفق — در صف باقی می‌ماند`, { error });
}

export async function cancelTask(id: string, actorId?: string | null, reason?: string): Promise<boolean> {
  const store = await getStore();
  const task = await store.getTask(id);
  if (!task) return false;
  if (task.status === "completed" || task.status === "cancelled") return false;
  await store.updateTask(id, { status: "cancelled", completedAt: new Date().toISOString(), error: reason ?? "cancelled" });
  await store.addTaskLog(id, "warn", "وظیفه لغو شد", { actorId: actorId ?? null, reason: reason ?? null });
  return true;
}

/** Retry: resets the attempt counter and re-runs the agent bound to the task. */
export async function retryTask(id: string, actorId?: string | null): Promise<{ ok: boolean; status: TaskStatus; result?: Record<string, unknown>; error?: string }> {
  const store = await getStore();
  const task = await store.getTask(id);
  if (!task) return { ok: false, status: "failed", error: "task_not_found" };
  if (task.status === "completed") return { ok: true, status: "completed", result: task.result ?? {} };

  await store.updateTask(id, { status: "pending", attempt: 0, error: null });
  await store.addTaskLog(id, "info", "تلاش مجدد توسط کاربر", { actorId: actorId ?? null });

  if (!task.agentKey) {
    // A human-assigned task simply goes back to the queue.
    return { ok: true, status: "pending" };
  }

  return runTask(id);
}

/** Execute an agent-backed task. */
export async function runTask(id: string): Promise<{ ok: boolean; status: TaskStatus; result?: Record<string, unknown>; error?: string }> {
  const store = await getStore();
  const task = await store.getTask(id);
  if (!task) return { ok: false, status: "failed", error: "task_not_found" };
  if (!task.agentKey) return { ok: false, status: task.status, error: "task_has_no_agent" };

  await markTaskRunning(id);
  try {
    const run = await runAgentByKey(task.agentKey, {
      input: (task.payload ?? {}) as Record<string, unknown>,
      userId: task.userId ?? null,
      sessionId: null,
      runId: task.workflowRunId ?? null,
      taskId: id,
      triggeredBy: "task_queue",
    });
    if (run.status === "waiting_approval") {
      await store.updateTask(id, { status: "waiting_approval", attempt: task.attempt + 1, result: run.output });
      await store.addTaskLog(id, "warn", "وظیفه منتظر تأیید انسانی است", { approval: run.approval ?? null });
      return { ok: false, status: "waiting_approval", result: run.output };
    }
    if (!run.ok) {
      await failTask(id, run.error ?? "agent_run_failed");
      return { ok: false, status: "failed", error: run.error };
    }
    await completeTask(id, run.output);
    return { ok: true, status: "completed", result: run.output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failTask(id, message);
    return { ok: false, status: "failed", error: message };
  }
}

/** Simple FIFO claim — used by the scheduler tick. */
export async function claimNextTask(filter: { agentKey?: string; limit?: number } = {}): Promise<TaskRecord | null> {
  const tasks = await listTasks({ status: "pending", agentKey: filter.agentKey, limit: filter.limit ?? 20 });
  return tasks[0] ?? null;
}

export async function taskQueueSummary(): Promise<{ total: number; byStatus: Record<TaskStatus, number> }> {
  const tasks = await listTasks({ limit: 500 });
  const byStatus: Record<TaskStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    waiting_approval: 0,
    cancelled: 0,
  };
  for (const task of tasks) byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
  return { total: tasks.length, byStatus };
}
