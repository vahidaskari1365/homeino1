"use client";
// ============================================================
// Approvals panel — Human Approval queue.
// Dangerous operations (price changes, refunds, deletions, outbound HTTP,
// browser tasks) stop here until a human decides. Approving executes the
// action for real and resumes the paused workflow run.
// ============================================================
import { useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { getJson, sendJson, type ApprovalRow } from "./client";
import { Cell, ErrorNote, Field, JsonBox, LoadingRow, NoData, PanelCard, RiskBadge, Row, StatusBadge, TableShell, inputClass, usePanelData } from "./Atoms";

interface ApprovalsPayload {
  items: ApprovalRow[];
  count: number;
  expiredNow: number;
  dataState: string;
}

const FILTERS = ["pending", "approved", "rejected", "expired"];

export function ApprovalsPanel() {
  const toast = useUi((s) => s.toast);
  const [status, setStatus] = useState("pending");
  const { data, error, loading, reload } = usePanelData<ApprovalsPayload>(
    () => getJson<ApprovalsPayload>(`/api/automation/approvals?status=${status}&limit=100`),
    [status],
  );
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  async function decide(approval: ApprovalRow, decision: "approved" | "rejected") {
    setBusyId(approval.id);
    try {
      const result = await sendJson<{ executed: boolean; error?: string | null }>(
        "POST",
        `/api/automation/approvals/${encodeURIComponent(approval.id)}`,
        { decision, note: note.trim() || undefined },
      );
      if (decision === "approved" && !result.executed) {
        toast(result.error ? `تصمیم ثبت شد اما اجرا ناموفق بود: ${result.error}` : "تصمیم ثبت شد", "info");
      } else {
        toast(decision === "approved" ? "تأیید و اجرا شد" : "رد شد");
      }
      setNote("");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "ثبت تصمیم ناموفق بود", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PanelCard
        title="تأییدهای انسانی"
        desc="عملیات پرخطر بدون تصمیم انسان اجرا نمی‌شود — حتی اگر ایجنت اجازه فنی داشته باشد"
        action={<ShieldCheck size={18} className="text-ink-muted" />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <Button key={item} size="sm" variant={status === item ? "primary" : "outline"} onClick={() => setStatus(item)}>{item}</Button>
          ))}
          {data.expiredNow > 0 && <span className="text-2xs text-ink-muted">{toFa(data.expiredNow)} درخواست منقضی شد</span>}
        </div>

        <Field label="یادداشت تصمیم (اختیاری — برای همه تصمیم‌های این نشست)">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: قیمت با فاکتور تأمین‌کننده بررسی شد" />
        </Field>

        <div className="mt-4">
          {data.items.length ? (
            <TableShell head={["عملیات", "ریسک", "ایجنت", "داده", "وضعیت", "تصمیم"]} minWidth={880}>
              {data.items.map((approval) => (
                <Row key={approval.id}>
                  <Cell>
                    <div className="font-medium text-ink" dir="ltr">{approval.action}</div>
                    {approval.reason && <div className="mt-1 text-2xs text-ink-muted">{approval.reason}</div>}
                    <div className="mt-1 text-2xs text-ink-muted">
                      {approval.createdAt ? toFa(new Date(approval.createdAt).toLocaleString("fa-IR")) : "—"}
                      {approval.expiresAt ? ` · انقضا: ${toFa(new Date(approval.expiresAt).toLocaleString("fa-IR"))}` : ""}
                    </div>
                  </Cell>
                  <Cell><RiskBadge risk={approval.riskLevel} /></Cell>
                  <Cell className="text-2xs"><span dir="ltr">{approval.agentKey ?? "—"}</span></Cell>
                  <Cell><JsonBox value={approval.payload ?? {}} max={8} /></Cell>
                  <Cell><StatusBadge status={approval.status} /></Cell>
                  <Cell>
                    {approval.status === "pending" ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" disabled={busyId === approval.id} onClick={() => decide(approval, "approved")}><CheckCircle2 size={14} /> تأیید و اجرا</Button>
                        <Button size="sm" variant="danger" disabled={busyId === approval.id} onClick={() => decide(approval, "rejected")}><XCircle size={14} /> رد</Button>
                      </div>
                    ) : (
                      <span className="text-2xs text-ink-muted">{approval.decidedBy ? `توسط ${approval.decidedBy.slice(0, 8)}…` : "تصمیم ثبت شده"}</span>
                    )}
                  </Cell>
                </Row>
              ))}
            </TableShell>
          ) : (
            <NoData title="درخواست تأییدی وجود ندارد" desc="صف خالی است — یعنی هیچ عملیات پرخطری در انتظار نیست." />
          )}
        </div>
      </PanelCard>
    </div>
  );
}
