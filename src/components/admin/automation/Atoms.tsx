"use client";
// ============================================================
// Shared atoms for the automation console — built from the same primitives and
// table markup the rest of the admin panel already uses (no new visual style).
// ============================================================
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

export function PanelCard({ title, desc, action, children }: { title: string; desc?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card-surface p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-black text-ink">{title}</h2>
          {desc && <p className="mt-1 text-xs text-ink-muted">{desc}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StatTile({ label, value, tone = "neutral", hint }: { label: string; value: ReactNode; tone?: "neutral" | "success" | "accent" | "gold" | "dark"; hint?: string }) {
  return (
    <div className="card-surface p-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-1.5 font-display text-xl font-black text-ink">{value}</div>
      {hint && <div className="mt-1"><Badge tone={tone}>{hint}</Badge></div>}
    </div>
  );
}

const STATUS_TONE: Record<string, "neutral" | "success" | "accent" | "gold" | "dark"> = {
  active: "success",
  completed: "success",
  approved: "success",
  running: "accent",
  queued: "neutral",
  pending: "gold",
  waiting_approval: "gold",
  draft: "neutral",
  paused: "gold",
  failed: "dark",
  rejected: "dark",
  cancelled: "dark",
  expired: "neutral",
  archived: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  active: "فعال",
  completed: "کامل",
  approved: "تأیید شده",
  running: "در حال اجرا",
  queued: "در صف",
  pending: "در انتظار",
  waiting_approval: "منتظر تأیید",
  draft: "پیش‌نویس",
  paused: "متوقف",
  failed: "ناموفق",
  rejected: "رد شده",
  cancelled: "لغو شده",
  expired: "منقضی",
  archived: "آرشیو",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function RiskBadge({ risk }: { risk: string }) {
  const tone = risk === "critical" ? "dark" : risk === "high" ? "accent" : risk === "medium" ? "gold" : "neutral";
  const label = { critical: "بحرانی", high: "پرخطر", medium: "متوسط", low: "کم‌خطر" }[risk] ?? risk;
  return <Badge tone={tone}>{label}</Badge>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/6 px-4 py-3 text-sm text-ink">
      <span className="flex items-center gap-2"><TriangleAlert size={16} className="text-danger" />{message}</span>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>تلاش دوباره</Button>}
    </div>
  );
}

export function TableShell({ head, children, minWidth = 640 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-clay/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
              {head.map((cell, index) => (
                <th key={index} className="p-3 font-medium">{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-b border-clay/30 align-top hover:bg-ivory-2/50">{children}</tr>;
}

export function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`p-3 text-ink ${className}`}>{children}</td>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-clay/60 bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-ink";

export function JsonBox({ value, max = 12 }: { value: unknown; max?: number }) {
  const [open, setOpen] = useState(false);
  const text = (() => {
    try {
      return JSON.stringify(value ?? null, null, 2);
    } catch {
      return String(value);
    }
  })();
  const lines = text.split("\n");
  const clipped = lines.length > max && !open;
  if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) {
    return <span className="text-xs text-ink-muted">—</span>;
  }
  return (
    <div className="space-y-1">
      <pre dir="ltr" className="max-w-full overflow-x-auto whitespace-pre rounded-lg bg-ivory-2 p-2 text-left text-2xs leading-5 text-ink-muted">
        {clipped ? lines.slice(0, max).join("\n") + "\n…" : text}
      </pre>
      {lines.length > max && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-2xs text-terracotta-deep">
          {open ? "بستن" : `نمایش همه (${toFa(lines.length)} خط)`}
        </button>
      )}
    </div>
  );
}

/**
 * Small data loader shared by every panel: loading / error / data + reload.
 * State updates happen only after the request settles (never synchronously in
 * the effect body) so React does not cascade renders.
 */
export function usePanelData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const result = await loader();
        if (!alive) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "خطای ناشناخته");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, nonce]);

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  return { data, error, loading, reload, setData };
}

export function LoadingRow({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-sm text-ink-muted">
      <Spinner /> {label}
    </div>
  );
}

export function NoData({ title, desc }: { title: string; desc?: string }) {
  return <EmptyState icon={<TriangleAlert size={26} />} title={title} desc={desc} />;
}
