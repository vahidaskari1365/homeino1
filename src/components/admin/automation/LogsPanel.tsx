"use client";
// ============================================================
// Logs panel — Execution Logs for agents and workflows, with per-step detail.
// ============================================================
import { useState } from "react";
import { FileSearch } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { getJson, type AgentRunRow, type StepRow, type WorkflowRunRow } from "./client";
import { Cell, ErrorNote, JsonBox, LoadingRow, NoData, PanelCard, Row, StatusBadge, TableShell, inputClass, usePanelData } from "./Atoms";

interface AgentLogsPayload {
  items: AgentRunRow[];
  count: number;
  summary: { runs: number; byStatus: Record<string, number>; totals: { costMicro: number; tokensIn: number; tokensOut: number; failed: number } };
  dataState: string;
}

interface WorkflowRunsPayload {
  items: WorkflowRunRow[];
  count: number;
  dataState: string;
}

const NODE_LABEL_FA: Record<string, string> = {
  trigger: "تریگر", condition: "شرط", agent: "ایجنت", db_query: "کوئری DB", db_update: "بروزرسانی DB",
  recommendation: "پیشنهاد", notification: "اعلان", delay: "تأخیر", schedule: "زمان‌بندی",
  human_approval: "تأیید انسانی", http_request: "HTTP", browser_task: "مرورگر", end: "پایان",
};

function faDate(value?: string | null) {
  return value ? toFa(new Date(value).toLocaleString("fa-IR")) : "—";
}

export function LogsPanel() {
  const toast = useUi((s) => s.toast);
  const [agentKey, setAgentKey] = useState("");
  const [workflowKey, setWorkflowKey] = useState("");
  const [steps, setSteps] = useState<{ runId: string; rows: StepRow[] } | null>(null);

  const agentLogs = usePanelData<AgentLogsPayload>(
    () => getJson<AgentLogsPayload>(`/api/automation/logs?limit=60${agentKey ? `&agentKey=${encodeURIComponent(agentKey)}` : ""}`),
    [agentKey],
  );
  const workflowRuns = usePanelData<WorkflowRunsPayload>(
    () => getJson<WorkflowRunsPayload>(`/api/automation/runs?limit=60${workflowKey ? `&workflowKey=${encodeURIComponent(workflowKey)}` : ""}`),
    [workflowKey],
  );

  async function openSteps(runId: string) {
    try {
      const detail = await getJson<{ run: WorkflowRunRow; steps: StepRow[] }>(`/api/automation/runs?runId=${encodeURIComponent(runId)}`);
      setSteps({ runId, rows: detail.steps ?? [] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "خواندن گام‌ها ناموفق بود", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PanelCard
        title="لاگ اجرای ایجنت‌ها"
        desc="هر اجرا: ورودی، خروجی، ابزارها، توکن، هزینه و خطا — بدون هیچ داده ساختگی"
        action={<input dir="ltr" className={`${inputClass} w-52`} placeholder="filter: agentKey" value={agentKey} onChange={(e) => setAgentKey(e.target.value)} />}
      >
        {agentLogs.loading ? (
          <LoadingRow />
        ) : agentLogs.error || !agentLogs.data ? (
          <ErrorNote message={agentLogs.error ?? "داده‌ای دریافت نشد"} onRetry={agentLogs.reload} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge>اجراهای ۷ روز: {toFa(agentLogs.data.summary.runs)}</Badge>
              <Badge tone={agentLogs.data.summary.totals.failed ? "dark" : "success"}>ناموفق: {toFa(agentLogs.data.summary.totals.failed)}</Badge>
              <Badge>توکن: {toFa((agentLogs.data.summary.totals.tokensIn + agentLogs.data.summary.totals.tokensOut).toLocaleString("fa-IR"))}</Badge>
              <Badge>هزینه: {toFa(agentLogs.data.summary.totals.costMicro.toLocaleString("fa-IR"))} میکرو</Badge>
            </div>
            {agentLogs.data.items.length ? (
              <TableShell head={["ایجنت", "وضعیت", "ابزارها", "توکن", "هزینه", "زمان", "شروع", "خطا"]} minWidth={980}>
                {agentLogs.data.items.map((run) => (
                  <Row key={run.id}>
                    <Cell className="text-2xs"><span dir="ltr" className="font-medium">{run.agentKey}</span><div className="text-ink-muted">{run.provider ?? "—"} · {run.model ?? "—"}</div></Cell>
                    <Cell><StatusBadge status={run.status} /></Cell>
                    <Cell><div className="flex flex-wrap gap-1">{run.toolsUsed.slice(0, 3).map((tool) => <Badge key={tool}>{tool}</Badge>)}{run.toolsUsed.length > 3 && <Badge>+{toFa(run.toolsUsed.length - 3)}</Badge>}{!run.toolsUsed.length && <span className="text-2xs text-ink-muted">—</span>}</div></Cell>
                    <Cell className="text-2xs text-ink-muted">{toFa((run.tokensIn + run.tokensOut).toLocaleString("fa-IR"))}</Cell>
                    <Cell className="text-2xs text-ink-muted">{toFa(run.costMicro.toLocaleString("fa-IR"))}</Cell>
                    <Cell className="text-2xs text-ink-muted">{toFa(run.durationMs ?? 0)}ms · تلاش {toFa(run.attempt)}</Cell>
                    <Cell className="text-2xs text-ink-muted">{faDate(run.startedAt)}</Cell>
                    <Cell className="text-2xs text-danger">{run.error ? `${run.errorCode ?? ""} ${run.error}`.slice(0, 90) : "—"}</Cell>
                  </Row>
                ))}
              </TableShell>
            ) : (
              <NoData title="لاگی ثبت نشده است" desc="هنوز اجرایی انجام نشده — لاگ‌ها ساختگی پر نمی‌شوند." />
            )}
          </>
        )}
      </PanelCard>

      <PanelCard
        title="اجراهای ورک‌فلو"
        desc="هر اجرا با گام‌های جداگانه و وضعیت هر گره"
        action={<input dir="ltr" className={`${inputClass} w-52`} placeholder="filter: workflowKey" value={workflowKey} onChange={(e) => setWorkflowKey(e.target.value)} />}
      >
        {workflowRuns.loading ? (
          <LoadingRow />
        ) : workflowRuns.error || !workflowRuns.data ? (
          <ErrorNote message={workflowRuns.error ?? "داده‌ای دریافت نشد"} onRetry={workflowRuns.reload} />
        ) : workflowRuns.data.items.length ? (
          <TableShell head={["ورک‌فلو", "تریگر", "وضعیت", "ابزارها", "هزینه", "شروع", "گام‌ها"]} minWidth={880}>
            {workflowRuns.data.items.map((run) => (
              <Row key={run.id}>
                <Cell className="text-2xs"><span dir="ltr" className="font-medium">{run.workflowKey ?? "—"}</span></Cell>
                <Cell className="text-xs">{run.triggerKind}</Cell>
                <Cell><StatusBadge status={run.status} /></Cell>
                <Cell><div className="flex flex-wrap gap-1">{run.toolsUsed.slice(0, 3).map((tool) => <Badge key={tool}>{tool}</Badge>)}{!run.toolsUsed.length && <span className="text-2xs text-ink-muted">—</span>}</div></Cell>
                <Cell className="text-2xs text-ink-muted">{toFa(run.costMicro.toLocaleString("fa-IR"))} میکرو · {toFa(run.durationMs ?? 0)}ms</Cell>
                <Cell className="text-2xs text-ink-muted">{faDate(run.startedAt)}</Cell>
                <Cell><Button size="sm" variant="ghost" onClick={() => openSteps(run.id)}><FileSearch size={14} /> گام‌ها</Button></Cell>
              </Row>
            ))}
          </TableShell>
        ) : (
          <NoData title="اجرای ورک‌فلویی ثبت نشده است" desc="یک ورک‌فلو را دستی اجرا کن تا گام‌ها اینجا ثبت شوند." />
        )}
      </PanelCard>

      <Modal open={Boolean(steps)} onClose={() => setSteps(null)} title={`گام‌های اجرای ${steps?.runId.slice(0, 8) ?? ""}`} description="ورودی/خروجی هر گره دقیقاً همان چیزی است که ذخیره شده">
        {steps && (
          steps.rows.length ? (
            <div className="space-y-3">
              {steps.rows.map((step, index) => (
                <div key={`${step.nodeKey}-${index}`} className="rounded-xl border border-clay/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium text-ink">{step.label ?? step.nodeKey}</span>
                    <Badge>{NODE_LABEL_FA[step.nodeType] ?? step.nodeType}</Badge>
                    <StatusBadge status={step.status} />
                    {step.agentKey && <Badge><span dir="ltr">{step.agentKey}</span></Badge>}
                    <span className="text-ink-muted">{toFa(step.durationMs ?? 0)}ms · توکن {toFa(step.tokensIn + step.tokensOut)} · هزینه {toFa(step.costMicro)}</span>
                  </div>
                  {step.error && <div className="mb-2 text-2xs text-danger">{step.error}</div>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><div className="mb-1 text-2xs font-medium text-ink-muted">ورودی</div><JsonBox value={step.input ?? {}} max={8} /></div>
                    <div><div className="mb-1 text-2xs font-medium text-ink-muted">خروجی</div><JsonBox value={step.output ?? {}} max={8} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <NoData title="گامی ثبت نشده است" desc="این اجرا گامی تولید نکرده است." />
          )
        )}
      </Modal>
    </div>
  );
}
