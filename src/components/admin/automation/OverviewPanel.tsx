"use client";
// ============================================================
// Overview — one honest snapshot of the agentic core.
// Everything here is read from the server; nothing is invented.
// ============================================================
import { Activity, Boxes, Cpu, Radar, ShieldCheck, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { getJson } from "./client";
import { ErrorNote, LoadingRow, PanelCard, StatTile, StatusBadge, TableShell, Row, Cell, usePanelData } from "./Atoms";

interface StatusPayload {
  store: { mode: string; reason: string };
  llm: { provider: string; configured: boolean; model?: string | null; reason?: string | null };
  browser: { provider: string; configured: boolean; reason?: string | null };
  integrations: Record<string, { available: boolean; error?: string | null }>;
  counts: { agents: number; activeAgents: number; workflows: number; activeWorkflows: number; tools: number; tasks: number; pendingApprovals: number };
  memory: { primary: string; mem0: string };
  executions: { runs: number; byStatus: Record<string, number>; totals: { costMicro: number; tokensIn: number; tokensOut: number; failed: number } };
  tasks: { total: number; byStatus: Record<string, number> };
  pendingApprovals: { id: string; action: string; riskLevel: string; status: string; createdAt?: string }[];
  budgets: { items: { scope: string; scopeKey?: string | null; dailyLimitMicro: number; monthlyLimitMicro: number; isActive: boolean }[]; status: { allowed: boolean; usage: { todayMicro: number; monthMicro: number; runsToday: number } } };
  schedule: { running: boolean; disabled: boolean; scheduledWorkflows: { key: string; name: string; status: string; nextRunAt?: string | null }[] };
  events: { total: number; uniqueUsers: number; uniqueSessions: number; byType: { eventType: string; count: number }[]; dataState: string };
  httpAllowlist: string[];
}

export function OverviewPanel() {
  const { data, error, loading, reload } = usePanelData<StatusPayload>(() => getJson<StatusPayload>("/api/automation/status"), []);

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="ایجنت‌های فعال" value={toFa(data.counts.activeAgents)} hint={`${toFa(data.counts.agents)} ثبت‌شده`} tone="success" />
        <StatTile label="ورک‌فلوهای فعال" value={toFa(data.counts.activeWorkflows)} hint={`${toFa(data.counts.workflows)} ثبت‌شده`} tone="accent" />
        <StatTile label="ابزارهای رجیسترشده" value={toFa(data.counts.tools)} hint="Tool Registry" />
        <StatTile label="تأییدهای انسانی در انتظار" value={toFa(data.counts.pendingApprovals)} hint={data.counts.pendingApprovals ? "نیازمند تصمیم" : "بدون معطلی"} tone={data.counts.pendingApprovals ? "gold" : "success"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="زیرساخت" desc="وضعیت واقعی ذخیره‌سازی، مدل زبانی، مرورگر و حافظه">
          <ul className="space-y-2 text-sm text-ink">
            <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Boxes size={16} className="text-ink-muted" />ذخیره‌سازی</span><Badge tone={data.store.mode === "database" ? "success" : "gold"}>{data.store.mode === "database" ? "پایگاه‌داده (Supabase)" : "حافظه فرآیند"}</Badge></li>
            <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Cpu size={16} className="text-ink-muted" />مدل زبانی</span><Badge tone={data.llm.configured ? "success" : "neutral"}>{data.llm.configured ? `${data.llm.provider}${data.llm.model ? ` · ${data.llm.model}` : ""}` : data.llm.reason ?? "پیکربندی نشده"}</Badge></li>
            <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Radar size={16} className="text-ink-muted" />مرورگر (Browser Use / Stagehand)</span><Badge tone={data.browser.configured ? "success" : "neutral"}>{data.browser.configured ? data.browser.provider : data.browser.reason ?? "پیکربندی نشده"}</Badge></li>
            <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-ink-muted" />حافظه مشتری</span><span className="text-xs text-ink-muted">{data.memory.primary} · Mem0: {data.memory.mem0}</span></li>
          </ul>
          <p className="mt-3 text-[11px] text-ink-muted">{data.store.reason}</p>
        </PanelCard>

        <PanelCard title="اتصال‌های بیرونی" desc="Dify / Langflow فقط پشت رابط قابل تعویض — هسته همیشه محلی است">
          <ul className="space-y-2 text-sm text-ink">
            {Object.entries(data.integrations).map(([name, info]) => (
              <li key={name} className="flex items-center justify-between gap-3">
                <span className="text-ink-muted">{name}</span>
                <Badge tone={info.available ? "success" : "neutral"}>{info.available ? "آماده" : info.error ?? "پیکربندی نشده"}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[11px] text-ink-muted">
            دامنه‌های مجاز HTTP: <span dir="ltr">{data.httpAllowlist.join("، ") || "—"}</span>
          </div>
        </PanelCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="اجراهای ۷ روز اخیر" desc="لاگ اجرای ایجنت‌ها (هزینه و توکن واقعی)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="تعداد اجرا" value={toFa(data.executions.runs)} />
            <StatTile label="ناموفق" value={toFa(data.executions.totals.failed)} tone={data.executions.totals.failed ? "dark" : "success"} />
            <StatTile label="توکن ورودی" value={toFa(data.executions.totals.tokensIn.toLocaleString("fa-IR"))} />
            <StatTile label="هزینه (میکرو)" value={toFa(data.executions.totals.costMicro.toLocaleString("fa-IR"))} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(data.executions.byStatus).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5 text-xs text-ink-muted"><StatusBadge status={status} /> {toFa(count)}</span>
            ))}
            {!Object.keys(data.executions.byStatus).length && <span className="text-xs text-ink-muted">هنوز اجرایی ثبت نشده است</span>}
          </div>
        </PanelCard>

        <PanelCard title="رویدادهای ۲۴ ساعت اخیر" desc="analytics_events — منبع اصلی حافظه و پیشنهادها">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="رویداد" value={toFa(data.events.total)} />
            <StatTile label="کاربر یکتا" value={toFa(data.events.uniqueUsers)} />
            <StatTile label="نشست یکتا" value={toFa(data.events.uniqueSessions)} />
          </div>
          {data.events.byType.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.events.byType.slice(0, 8).map((entry) => (
                <Badge key={entry.eventType}>{entry.eventType} · {toFa(entry.count)}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">رویدادی ثبت نشده است — داده‌ای برای ادعا وجود ندارد.</p>
          )}
        </PanelCard>
      </div>

      <PanelCard title="صف وظایف و زمان‌بندی" desc="Task Queue + Scheduler (قابل اجرا با کرون یا دستی)">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink"><Activity size={16} className="text-ink-muted" /> وظایف: {toFa(data.tasks.total)}</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.tasks.byStatus).map(([status, count]) => (
                <span key={status} className="flex items-center gap-1.5 text-xs text-ink-muted"><StatusBadge status={status} /> {toFa(count)}</span>
              ))}
              {!Object.keys(data.tasks.byStatus).length && <span className="text-xs text-ink-muted">صف خالی است</span>}
            </div>
            <div className="mt-3 text-xs text-ink-muted">
              سقف هزینه امروز: {toFa(data.budgets.status.usage.todayMicro.toLocaleString("fa-IR"))} میکرو · اجراهای امروز: {toFa(data.budgets.status.usage.runsToday)} ·
              {" "}{data.budgets.status.allowed ? "اجازه اجرا فعال است" : "اجرا به دلیل سقف هزینه مسدود است"}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink"><Workflow size={16} className="text-ink-muted" /> زمان‌بندی‌شده‌ها</div>
            {data.schedule.scheduledWorkflows.length ? (
              <TableShell head={["ورک‌فلو", "وضعیت", "اجرای بعدی"]} minWidth={360}>
                {data.schedule.scheduledWorkflows.map((wf) => (
                  <Row key={wf.key}>
                    <Cell className="font-medium">{wf.name}</Cell>
                    <Cell><StatusBadge status={wf.status} /></Cell>
                    <Cell className="text-xs text-ink-muted" >{wf.nextRunAt ? toFa(new Date(wf.nextRunAt).toLocaleString("fa-IR")) : "—"}</Cell>
                  </Row>
                ))}
              </TableShell>
            ) : (
              <p className="text-xs text-ink-muted">ورک‌فلوی زمان‌بندی‌شده‌ای وجود ندارد.</p>
            )}
            <p className="mt-2 text-[11px] text-ink-muted">
              زمان‌بند درون‌فرآیندی: {data.schedule.running ? "در حال اجرا" : data.schedule.disabled ? "غیرفعال (محیط سرورلس — از کرون استفاده کن)" : "خاموش"}
            </p>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
