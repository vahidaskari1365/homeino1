// ============================================================
// HOMEINO — AGENT OBSERVABILITY (execution log)
//
// Every agent execution is recorded: agent, workflow, user, started/finished,
// status, input, output, tools used, tokens, duration and error. The admin
// panel reads this through /api/automation/logs.
// ============================================================
import { getStore } from "../agents/store";
import type { AgentRunRecord, RunRecord } from "../agents/store/types";
import type { RunStatus } from "../agents/types";

export async function recordAgentRun(record: Omit<AgentRunRecord, "id"> & { id?: string }): Promise<string> {
  const store = await getStore();
  return store.logAgentRun(record);
}

export async function listExecutionLogs(filter?: { agentKey?: string; runId?: string; status?: RunStatus; limit?: number }): Promise<AgentRunRecord[]> {
  const store = await getStore();
  return store.listAgentRuns(filter);
}

export async function listWorkflowRuns(filter?: { workflowKey?: string; status?: RunStatus; limit?: number }): Promise<RunRecord[]> {
  const store = await getStore();
  return store.listRuns(filter);
}

export interface ExecutionSummary {
  window: { since: string; until: string };
  runs: number;
  byStatus: Record<string, number>;
  byAgent: { agentKey: string; runs: number; costMicro: number; tokensIn: number; tokensOut: number; avgDurationMs: number }[];
  totals: { costMicro: number; tokensIn: number; tokensOut: number; durationMs: number; failed: number };
}

export async function executionSummary(days = 7): Promise<ExecutionSummary> {
  const store = await getStore();
  const since = new Date(Date.now() - days * 86_400_000);
  const logs = await store.listAgentRuns({ limit: 1000 });
  const windowLogs = logs.filter((log) => new Date(log.startedAt).getTime() >= since.getTime());

  const byStatus: Record<string, number> = {};
  const byAgent = new Map<string, { runs: number; costMicro: number; tokensIn: number; tokensOut: number; durationMs: number }>();

  for (const log of windowLogs) {
    byStatus[log.status] = (byStatus[log.status] ?? 0) + 1;
    const entry = byAgent.get(log.agentKey) ?? { runs: 0, costMicro: 0, tokensIn: 0, tokensOut: 0, durationMs: 0 };
    entry.runs += 1;
    entry.costMicro += log.costMicro ?? 0;
    entry.tokensIn += log.tokensIn ?? 0;
    entry.tokensOut += log.tokensOut ?? 0;
    entry.durationMs += log.durationMs ?? 0;
    byAgent.set(log.agentKey, entry);
  }

  return {
    window: { since: since.toISOString(), until: new Date().toISOString() },
    runs: windowLogs.length,
    byStatus,
    byAgent: [...byAgent.entries()]
      .map(([agentKey, value]) => ({
        agentKey,
        runs: value.runs,
        costMicro: value.costMicro,
        tokensIn: value.tokensIn,
        tokensOut: value.tokensOut,
        avgDurationMs: value.runs ? Math.round(value.durationMs / value.runs) : 0,
      }))
      .sort((a, b) => b.runs - a.runs),
    totals: {
      costMicro: windowLogs.reduce((sum, log) => sum + (log.costMicro ?? 0), 0),
      tokensIn: windowLogs.reduce((sum, log) => sum + (log.tokensIn ?? 0), 0),
      tokensOut: windowLogs.reduce((sum, log) => sum + (log.tokensOut ?? 0), 0),
      durationMs: windowLogs.reduce((sum, log) => sum + (log.durationMs ?? 0), 0),
      failed: windowLogs.filter((log) => log.status === "failed").length,
    },
  };
}
