"use client";
import { useEffect, useState } from "react";
import { toFa } from "@/lib/utils";

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");

/**
 * Live countdown to `endsAt` (ISO). SSR-safe: renders nothing until mounted,
 * hides itself completely when the deadline passes — no fake urgency.
 */
export function CountdownTimer({ endsAt, size = "md" }: { endsAt: string; size?: "sm" | "md" }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(endsAt).getTime();
    if (!Number.isFinite(target)) return;
    const tick = () => {
      const left = target - Date.now();
      setRemaining(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (remaining === null) return null; // hydration-safe first paint
  if (remaining <= 0) return null; // campaign over → nothing shown

  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const cell =
    size === "sm"
      ? "min-w-8 rounded-md bg-white/10 px-1 py-0.5 text-center font-display text-sm font-bold tabular-nums"
      : "min-w-10 rounded-lg bg-white/10 px-1.5 py-1 text-center font-display text-lg font-black tabular-nums";

  return (
    <div dir="ltr" className="flex items-center gap-1" aria-label="زمان باقی‌مانده کمپین">
      {[pad2(h), pad2(m), pad2(s)].map((v, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-white/50">:</span>}
          <span className={cell}>{toFa(v)}</span>
        </span>
      ))}
    </div>
  );
}
