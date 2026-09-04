// ============================================================
// HOMEINO — WORKFLOW RUNTIME INTERFACE
//
//   local    → the in-repo engine (always available, zero external deps)
//   dify     → POST {base}/workflows/run
//   langflow → POST {base}/api/v1/run/{flowId}
//
// An unconfigured external runtime falls back to the local engine (and the run
// output says which runtime actually executed it) instead of failing silently.
// ============================================================
import type { AgentSchedule, WorkflowDefinition, WorkflowRunRequest, WorkflowRunResult, WorkflowRuntime, WorkflowValidationIssue } from "../agents/types";
import { getStore } from "../agents/store";
import { executeWorkflow, nextScheduleRun } from "./engine";
import { validateWorkflow } from "./registry";
import { difyWorkflowRuntime, langflowWorkflowRuntime } from "../agents/integrations/externalRuntimes";

const fallbackResult = (workflowKey: string, error: string): WorkflowRunResult => ({
  ok: false,
  status: "failed",
  workflowKey,
  output: {},
  steps: [],
  usage: { provider: "local", model: "-", tokensIn: 0, tokensOut: 0, costMicro: 0, durationMs: 0 },
  error,
  errorCode: "VALIDATION_FAILED",
  dataState: "no_data",
});

async function validateIssues(def: WorkflowDefinition): Promise<WorkflowValidationIssue[]> {
  const result = await validateWorkflow(def);
  return [
    ...result.errors.map((message): WorkflowValidationIssue => ({ level: "error", message })),
    ...result.warnings.map((message): WorkflowValidationIssue => ({ level: "warning", message })),
  ];
}

export const localWorkflowRuntime: WorkflowRuntime = {
  name: "local",
  available: true,
  error: null,
  async execute(req: WorkflowRunRequest): Promise<WorkflowRunResult> {
    const store = await getStore();
    const workflow = await store.getWorkflow(req.workflowKey);
    if (!workflow) return fallbackResult(req.workflowKey, `ورک‌فلو پیدا نشد: ${req.workflowKey}`);
    const result = await executeWorkflow(workflow, req);
    return { ...result, output: { ...result.output, _runtime: "local" } };
  },
  validate: validateIssues,
  async schedule(def: WorkflowDefinition, schedule: AgentSchedule): Promise<{ nextRunAt: Date | null }> {
    return { nextRunAt: nextScheduleRun(schedule ?? def.schedule) };
  },
};

export function resolveWorkflowRuntime(workflow: { runtime?: string | null }, fallback: WorkflowRuntime = localWorkflowRuntime): WorkflowRuntime {
  const runtime = String(workflow.runtime ?? "local");
  if (runtime === "dify") {
    return difyWorkflowRuntime.available ? difyWorkflowRuntime : { ...fallback, name: "local", error: `fallback from dify: ${difyWorkflowRuntime.error ?? "not configured"}` };
  }
  if (runtime === "langflow") {
    return langflowWorkflowRuntime.available ? langflowWorkflowRuntime : { ...fallback, name: "local", error: `fallback from langflow: ${langflowWorkflowRuntime.error ?? "not configured"}` };
  }
  return fallback;
}

/** Single entry point used by the API routes and the orchestrator. */
export async function runWorkflow(
  workflowKey: string,
  req: Omit<Partial<WorkflowRunRequest>, "workflowKey"> = {},
): Promise<WorkflowRunResult> {
  const store = await getStore();
  const workflow = await store.getWorkflow(workflowKey);
  const request: WorkflowRunRequest = {
    workflowKey,
    triggerKind: req.triggerKind ?? "manual",
    triggerPayload: req.triggerPayload ?? {},
    input: req.input ?? {},
    userId: req.userId ?? null,
    sessionId: req.sessionId ?? null,
    actorRole: req.actorRole ?? "system",
    actorId: req.actorId ?? null,
  };
  const runtime = workflow ? resolveWorkflowRuntime(workflow) : localWorkflowRuntime;
  return runtime.execute(request);
}

export { difyWorkflowRuntime, langflowWorkflowRuntime };
