// REAL agent/AI telemetry — no fabricated numbers. Data sources:
//   • executionSummary(7)  → actual agent runs recorded in the store (DB when
//     configured, in-process otherwise) — runs, tokens, duration per agent.
//   • orchestratorStatus() → live counts of agents/workflows/tools + store mode.
//   • getRecentAiRequests  → the AI gateway's own request telemetry (last 500).
// Empty windows show honest empty states instead of placeholder rows.
import { Sparkles, TrendingUp, Bot } from "lucide-react";
import { toFa } from "@/lib/utils";
import { executionSummary } from "@/services/automation/executionLog";
import { orchestratorStatus } from "@/services/agents/orchestrator";
import { listAgents } from "@/services/agents/registry";
import { getRecentAiRequests } from "@/services/ai/telemetry";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  const [summary, status, agents] = await Promise.all([
    executionSummary(7).catch(() => null),
    orchestratorStatus().catch(() => null),
    listAgents().catch(() => []),
  ]);
  const agentName = new Map(agents.map((a) => [a.key, a.name] as const));

  const runs7d = summary?.runs ?? 0;
  const recent = getRecentAiRequests(500);
  const okCount = recent.filter((r) => r.status === "ok").length;
  const successRate = recent.length ? Math.round((okCount / recent.length) * 100) : null;

  const stats = [
    {
      icon: Bot,
      color: "text-terracotta-deep",
      value: runs7d ? toFa(runs7d.toLocaleString("fa-IR")) : "۰",
      label: "اجرای واقعی ایجنت‌ها (۷ روز اخیر)",
    },
    {
      icon: Sparkles,
      color: "text-gold",
      value: status ? `${toFa(status.counts.activeAgents.toLocaleString("fa-IR"))} / ${toFa(status.counts.agents.toLocaleString("fa-IR"))}` : "—",
      label: `ایجنت‌های فعال${status ? ` · منبع داده: ${status.store.mode === "database" ? "دیتابیس" : "حافظه"}` : ""}`,
    },
    {
      icon: TrendingUp,
      color: "text-success",
      value: successRate != null ? `${toFa(successRate)}٪` : "—",
      label: recent.length ? `نرخ موفقیت دروازه AI (${toFa(recent.length.toLocaleString("fa-IR"))} درخواست اخیر)` : "هنوز درخواستی در این سرور ثبت نشده",
    },
  ];

  const rows = (summary?.byAgent ?? []).slice().sort((a, b) => b.runs - a.runs);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">مصرف هومینو استودیو</h1>
        <p className="mt-1 text-xs text-ink-muted">
          داده‌های واقعی اجرای ایجنت‌ها و دروازه AI — بدون عدد فرضی
          {summary ? ` · بازه: ${toFa(new Date(summary.window.since).toLocaleDateString("fa-IR"))} تا ${toFa(new Date(summary.window.until).toLocaleDateString("fa-IR"))}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <s.icon size={20} className={s.color} />
            <div className="mt-2 font-display text-2xl font-black text-ink">{s.value}</div>
            <div className="text-xs text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card-surface overflow-hidden">
        <div className="border-b border-clay/40 bg-ivory-2 px-3 py-2.5 text-xs font-bold text-ink">جزئیات به تفکیک ایجنت (۷ روز اخیر)</div>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
                <th className="p-3 font-medium">ایجنت</th>
                <th className="p-3 font-medium">اجراها</th>
                <th className="p-3 font-medium">توکن ورودی</th>
                <th className="p-3 font-medium">توکن خروجی</th>
                <th className="p-3 font-medium">میانگین زمان</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.agentKey} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3 text-ink">{agentName.get(r.agentKey) ?? r.agentKey}</td>
                  <td className="p-3 text-ink">{toFa(r.runs.toLocaleString("fa-IR"))}</td>
                  <td className="p-3 text-ink">{toFa(r.tokensIn.toLocaleString("fa-IR"))}</td>
                  <td className="p-3 text-ink">{toFa(r.tokensOut.toLocaleString("fa-IR"))}</td>
                  <td className="p-3 text-ink">{toFa(Math.round(r.avgDurationMs).toLocaleString("fa-IR"))} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-sm text-ink-muted">
            در ۷ روز گذشته اجرایی برای ایجنت‌ها ثبت نشده است. ایجنت‌ها با اولین گفت‌وگوی مشتری یا اجرای زمان‌بندی‌شده (هر ۵ دقیقه) شروع به ثبت می‌کنند — جزئیات در «اتوماسیون → گزارش‌ها».
          </div>
        )}
      </div>
    </div>
  );
}
