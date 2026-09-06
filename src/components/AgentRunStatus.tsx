// ============================================================
// AgentRunStatus — PUBLIC trust strip for content agents.
//
// Reads src/data/agent-runs/<agentKey>.json (committed to the
// repo by the daily GitHub Actions workflows themselves — one
// file per agent so concurrent agents never merge-conflict) and
// renders the REAL last execution per content agent. No admin
// login needed — the evidence ships inside the bundle, exactly
// as the bot wrote it. Honest by construction: if no run was
// ever recorded, the strip says so instead of pretending.
// ============================================================
import inspirationRuns from "@/data/agent-runs/inspiration-curator.json";
import magazineRuns from "@/data/agent-runs/magazine-editor.json";

export interface AgentRun {
  id: string;
  at: string;
  agentKey: string;
  ok: boolean;
  dry?: boolean;
  durationMs?: number;
  summary?: string;
}

type RunFile = { agentKey?: string; updatedAt?: string | null; runs?: AgentRun[] };

const runs: AgentRun[] = [inspirationRuns, magazineRuns]
  .flatMap((f) => ((f as RunFile)?.runs ?? []) as AgentRun[])
  .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

export function lastRunFor(agentKey: string): AgentRun | null {
  return runs.find((r) => r.agentKey === agentKey) ?? null;
}

export function totalRunsFor(agentKey: string): number {
  return runs.filter((r) => r.agentKey === agentKey).length;
}

/** «۲ ساعت پیش» — Persian relative time (Node 20 full-ICU safe). */
export function relativeFa(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs)) return "";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "همین حالا";
  const rtf = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

const AGENTS: { key: string; label: string }[] = [
  { key: "magazine-editor", label: "ایجنت مجله و ترندها" },
  { key: "inspiration-curator", label: "ایجنت الهام (پین‌ها)" },
];

export function AgentRunStatus() {
  return (
    <div className="mb-8 rounded-2xl card-surface px-4 py-3 text-sm leading-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="font-black">کارکرد خودکار ایجنت‌ها</span>
        {AGENTS.map(({ key, label }) => {
          const run = lastRunFor(key);
          const total = totalRunsFor(key);
          return (
            <span key={key} className="inline-flex flex-wrap items-center gap-1.5">
              <span aria-hidden className={run ? (run.ok ? "text-emerald-600" : "text-amber-600") : "text-ink-muted"}>
                ●
              </span>
              <span className="font-bold">{label}:</span>
              {run ? (
                <span className="text-ink-muted">
                  آخرین اجرا {relativeFa(run.at)}
                  {run.summary ? ` — ${run.summary.replace(/\s+/g, " ").slice(0, 90)}` : ""}
                  <span className="opacity-60"> ({total.toLocaleString("fa-IR")} اجرا در تاریخچه)</span>
                </span>
              ) : (
                <span className="text-ink-muted">هنوز اجرایی ثبت نشده — نوبت‌های زمان‌بندی‌شده در راه است</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
