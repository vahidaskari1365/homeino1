import type { Metadata } from "next";
import Link from "next/link";
import inspirationRuns from "@/data/agent-runs/inspiration-curator.json";
import magazineRuns from "@/data/agent-runs/magazine-editor.json";
import { relativeFa } from "@/components/AgentRunStatus";

export const metadata: Metadata = {
  title: "وضعیت ایجنت‌های هومینو — کارکرد خودکار و شفاف",
  description:
    "گزارش زنده و بدون نیاز به ورود از کارکرد خودکار ایجنت‌های محتوای هومینو: آخرین اجراها، خلاصه فعالیت و تاریخچه.",
  alternates: { canonical: "/agents" },
  openGraph: {
    title: "وضعیت ایجنت‌های هومینو",
    description: "کارکرد خودکار و شفاف ایجنت‌های محتوای هومینو — بدون نیاز به ورود.",
    type: "website",
    locale: "fa_IR",
    url: "/agents",
  },
};

type RunFile = { agentKey?: string; updatedAt?: string | null; runs?: AgentRunRow[] };
interface AgentRunRow {
  id: string;
  at: string;
  agentKey: string;
  ok: boolean;
  dry?: boolean;
  durationMs?: number;
  summary?: string;
}

const AGENTS: { key: string; label: string; blurb: string; schedule: string }[] = [
  {
    key: "magazine-editor",
    label: "ایجنت مجله و ترندها",
    blurb:
      "هر روز صبح فیدهای معتبرترین نشریات دیزاین دنیا را می‌خواند، تازه‌ترین ترندها را انتخاب می‌کند و بریف‌های فارسیِ بازنویسی‌شده برای «ترندهای روز» می‌نویسد.",
    schedule: "روزی ۱ بار — ۷:۳۰ صبح به وقت تهران",
  },
  {
    key: "inspiration-curator",
    label: "ایجنت الهام (پین‌ها)",
    blurb:
      "روی چرخه سبک × فضا حرکت می‌کند، عکس‌های چیدمان واقعی پیدا می‌کند، اعتبار منبع را چک می‌کند و پین‌های فارسی اورجینال به گالری الهام اضافه می‌کند.",
    schedule: "روزی ۳ بار — ۷:۰۰، ۱۲:۰۰ و ۱۷:۰۰ به وقت تهران",
  },
];

function faDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span aria-hidden className={ok ? "text-emerald-600" : "text-amber-600"}>
      ●
    </span>
  );
}

export default function AgentsStatusPage() {
  const byAgent = new Map<string, AgentRunRow[]>();
  for (const file of [inspirationRuns, magazineRuns] as RunFile[]) {
    for (const run of file.runs ?? []) {
      const list = byAgent.get(run.agentKey) ?? [];
      list.push(run);
      byAgent.set(run.agentKey, list);
    }
  }
  const totalRuns = [...byAgent.values()].reduce((s, l) => s + l.length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <header className="mb-8">
        <h1 className="text-2xl font-black leading-9">وضعیت ایجنت‌های هومینو</h1>
        <p className="mt-2 text-sm leading-7 text-ink-muted">
          این صفحه <b className="text-ink">بدون نیاز به ورود</b>، کارکرد واقعی ایجنت‌های محتوای هومینو را نشان می‌دهد.
          ایجنت‌ها روی GitHub Actions اجرا می‌شوند و بعد از هر اجرا، نتیجه‌شان به‌صورت خودکار در همین سایت ثبت می‌شود —
          چیزی که اینجا می‌بینید همان لاگ رسمی اجراست، نه وعده. تا این لحظه{" "}
          <b className="text-ink">{totalRuns.toLocaleString("fa-IR")} اجرا</b> ثبت شده است.
        </p>
      </header>

      <div className="space-y-6">
        {AGENTS.map((agent) => {
          const runs = (byAgent.get(agent.key) ?? []).sort((a, b) => (a.at < b.at ? 1 : -1));
          const last = runs[0] ?? null;
          const okCount = runs.filter((r) => r.ok).length;
          return (
            <section key={agent.key} className="card-surface rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-black">{agent.label}</h2>
                <span className="rounded-full bg-ivory-2 px-3 py-1 text-xs text-ink-muted">{agent.schedule}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-ink-muted">{agent.blurb}</p>

              {last ? (
                <div className="mt-4 rounded-xl border border-ivory-3 bg-ivory-1 px-4 py-3 text-sm leading-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusDot ok={last.ok} />
                    <b>آخرین اجرا:</b>
                    <span>{relativeFa(last.at)}</span>
                    <span className="text-xs text-ink-muted">({faDateTime(last.at)})</span>
                  </div>
                  {last.summary ? <p className="mt-1 text-ink-muted">{last.summary}</p> : null}
                  <p className="mt-2 text-xs text-ink-muted">
                    تاریخچه: {okCount.toLocaleString("fa-IR")} اجرای موفق از {runs.length.toLocaleString("fa-IR")} اجرای ثبت‌شده
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-ivory-3 bg-ivory-1 px-4 py-3 text-sm text-ink-muted">
                  هنوز اجرایی ثبت نشده — نوبت‌های زمان‌بندی‌شده در راه است.
                </p>
              )}

              {runs.length > 0 ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-bold text-ink">تاریخچه اجراها</summary>
                  <ul className="mt-3 space-y-2">
                    {runs.slice(0, 12).map((run) => (
                      <li key={run.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-6">
                        <StatusDot ok={run.ok} />
                        <span className="text-xs text-ink-muted" dir="ltr">
                          {faDateTime(run.at)}
                        </span>
                        <span className="text-ink-muted">{run.summary ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs leading-6 text-ink-muted">
        برای دیدن جزئیات بیشتر،{" "}
        <Link href="/trends" className="text-ink underline decoration-ivory-3 underline-offset-4 hover:decoration-ink">
          ترندهای روز
        </Link>
        ،{" "}
        <Link href="/magazine" className="text-ink underline decoration-ivory-3 underline-offset-4 hover:decoration-ink">
          مجله
        </Link>{" "}
        و{" "}
        <Link href="/inspiration" className="text-ink underline decoration-ivory-3 underline-offset-4 hover:decoration-ink">
          گالری الهام
        </Link>{" "}
        را ببینید — بالای هر کدام نوار وضعیت ایجنت‌ها نمایش داده می‌شود.
      </p>
    </div>
  );
}
