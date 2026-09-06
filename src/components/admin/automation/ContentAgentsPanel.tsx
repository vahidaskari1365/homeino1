"use client";
// ============================================================
// ContentAgentsPanel — کارکرد واقعی ایجنت‌های محتوا (خارج از سرور)
//
// ایجنت الهام (Pinterest) و ایجنت مجله روی GitHub Actions اجرا
// می‌شوند؛ تاریخچه اجرایشان از src/data/agent-runs.json می‌آید —
// همان فایلی که خودِ ایجنت‌ها بعد از هر اجرا آپدیت می‌کنند.
// ============================================================
import { CalendarClock, Image as ImageIcon, Newspaper, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { getJson } from "./client";
import { ErrorNote, LoadingRow, PanelCard, StatTile, usePanelData } from "./Atoms";

interface ContentRun {
  id: string;
  at: string;
  agentKey: string;
  ok: boolean;
  dry?: boolean;
  durationMs?: number;
  summary?: string;
  detail?: { added?: number; total?: number; via?: string; combos?: string[]; titles?: string[]; sources?: string[] };
}

interface ContentAgentsPayload {
  agents: {
    key: string;
    name: string;
    description: string;
    status: string;
    schedule: { kind: string; cron?: string } | null;
    config?: Record<string, unknown>;
  }[];
  runs: ContentRun[];
  perAgent: Record<string, { runs: number; ok: number; failed: number; itemsAdded: number; lastRunAt: string | null; lastSummary: string | null }>;
  updatedAt: string | null;
  dataState: string;
}

const AGENT_ICON: Record<string, typeof ImageIcon> = {
  "inspiration-curator": ImageIcon,
  "magazine-editor": Newspaper,
};

const AGENT_LABEL: Record<string, string> = {
  "inspiration-curator": "ایجنت الهام",
  "magazine-editor": "ایجنت مجله",
};

function faTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ContentAgentsPanel() {
  const { data, error, loading, reload } = usePanelData<ContentAgentsPayload>(
    () => getJson<ContentAgentsPayload>("/api/automation/content-runs?days=14"),
    [],
  );

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          این ایجنت‌ها روی GitHub Actions (کرون ابری) اجرا می‌شوند و بعد از هر اجرا، نتیجه واقعی‌شان را همین‌جا ثبت می‌کنند.
        </p>
        <button type="button" onClick={reload} className="flex items-center gap-1.5 rounded-lg border border-ivory-3 px-2.5 py-1.5 text-xs text-ink-muted transition hover:bg-ivory-2 hover:text-ink">
          <RefreshCw size={13} /> بروزرسانی
        </button>
      </div>

      {/* کارت هر ایجنت */}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.agents.map((agent) => {
          const stat = data.perAgent[agent.key];
          const Icon = AGENT_ICON[agent.key] ?? CalendarClock;
          return (
            <PanelCard key={agent.key} title={agent.name} desc={agent.description}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="اجراهای ۱۴ روز" value={toFa(stat?.runs ?? 0)} />
                <StatTile label="موفق" value={toFa(stat?.ok ?? 0)} tone={stat?.failed ? "gold" : "success"} />
                <StatTile label="محتوای افزوده" value={toFa(stat?.itemsAdded ?? 0)} tone="accent" hint="پین / بریف" />
                <StatTile label="آخرین اجرا" value={faTime(stat?.lastRunAt)} />
              </div>
              <div className="mt-3 space-y-2 text-xs text-ink-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon size={14} />
                  <Badge tone={agent.status === "active" ? "success" : "neutral"}>
                    {agent.status === "active" ? "فعال" : "غیرفعال"}
                  </Badge>
                  {agent.schedule?.cron ? (
                    <span className="rounded bg-ivory-2 px-1.5 py-0.5 font-mono" dir="ltr">{agent.schedule.cron} UTC</span>
                  ) : null}
                  <span>آخرین نتیجه: {stat?.lastSummary ?? "هنوز اجرایی ثبت نشده"}</span>
                </div>
              </div>
            </PanelCard>
          );
        })}
      </div>

      {/* تاریخچه اجرا */}
      <PanelCard title="تاریخچه اجرا (۱۴ روز اخیر)" desc="هر ردیف یک اجرای واقعی ایجنت است — با خلاصه و تعداد محتوای افزوده">
        {data.runs.length === 0 ? (
          <p className="text-sm text-ink-muted">
            هنوز اجرایی در این بازه ثبت نشده. ایجنت‌ها طبق زمان‌بندی بالا اجرا می‌شوند و نتیجه‌شان خودکار اینجا می‌آید.
          </p>
        ) : (
          <div className="space-y-2">
            {data.runs.slice(0, 30).map((run) => (
              <div key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ivory-3 px-3 py-2 text-sm">
                <Badge tone={run.ok ? "success" : "gold"}>{run.ok ? "موفق" : "بدون نتیجه"}</Badge>
                <span className="font-medium text-ink">{AGENT_LABEL[run.agentKey] ?? run.agentKey}</span>
                <span className="text-xs text-ink-muted">{faTime(run.at)}</span>
                {run.durationMs ? <span className="text-2xs text-ink-muted">{toFa(Math.round(run.durationMs / 1000))} ثانیه</span> : null}
                {run.dry ? <span className="text-2xs text-ink-muted">(اجرای آزمایشی)</span> : null}
                <span className="text-xs text-ink-muted">{run.summary}</span>
                {run.detail?.combos?.length ? (
                  <span className="text-2xs text-ink-muted" dir="rtl">{run.detail.combos.slice(0, 4).join(" · ")}{run.detail.combos.length > 4 ? " …" : ""}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-2xs text-ink-muted">
          آخرین بروزرسانی فایل تاریخچه: {faTime(data.updatedAt)}
        </p>
      </PanelCard>
    </div>
  );
}
