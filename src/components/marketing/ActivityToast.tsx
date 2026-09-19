"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { fetchMarketingStats, type MarketingStats } from "@/lib/commerceClient";
import { toFa } from "@/lib/utils";

const ROOM_LABELS: Record<string, string> = {
  living: "اتاق نشیمن",
  "living-room": "اتاق نشیمن",
  bedroom: "اتاق خواب",
  kitchen: "آشپزخانه",
  bathroom: "سرویس بهداشتی",
  dining: "اتاق غذاخوری",
  office: "اتاق کار",
  "home-office": "اتاق کار",
  kids: "اتاق کودک",
  outdoor: "فضای بیرونی",
  hallway: "ورودی",
  "walk-in": "کمد لباس",
};

function roomLabel(roomType: string | null): string {
  if (!roomType) return "فضای خانه";
  const key = roomType.toLowerCase().trim();
  return ROOM_LABELS[key] ?? key.replace(/[-_]/g, " ");
}

function styleLabel(style: string | null): string {
  if (!style) return "";
  const map: Record<string, string> = {
    modern: "مدرن", minimal: "مینیمال", classic: "کلاسیک", boho: "بوگو", industrial: "صنعتی",
    japandi: "ژاپاندی", scandinavian: "اسکاندیناوی", traditional: "سنتی", neoclassic: "نئوکلاسیک", rustic: "روستیک",
  };
  const key = style.toLowerCase().trim();
  return map[key] ? ` ${map[key]}` : ` ${key.replace(/[-_]/g, " ")}`;
}

function agoText(minutes: number): string {
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${toFa(h)} ساعت پیش`;
  return `${toFa(Math.floor(h / 24))} روز پیش`;
}

/**
 * Live activity toast (Temu-style social proof) — ONLY real, anonymized
 * data from the DB. If nothing happened recently, it stays silent.
 * Respects dismissal per session and pauses when the tab is hidden.
 */
export function ActivityToast() {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [current, setCurrent] = useState<number>(-1);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true); // SSR-safe: starts hidden
  const cycle = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("homeino:activity-dismissed")) return;
    } catch { /* private mode → allowed */ }
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      fetchMarketingStats().then((res) => {
        if (!alive) return;
        setDismissed(false); // async → hydration-safe
        if (res.ok) setStats(res.data);
      });
    };
    load();
    const poll = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (dismissed || !stats || stats.recent.length === 0) return;
    const showNext = () => {
      if (document.hidden || cycle.current >= 10) return; // max 10 toasts per session
      setCurrent((i) => (i + 1) % stats.recent.length);
      setVisible(true);
      cycle.current += 1;
      setTimeout(() => setVisible(false), 6_000);
    };
    const first = setTimeout(showNext, 6_000);
    const loop = setInterval(showNext, 18_000);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, [stats, dismissed]);

  if (dismissed || !stats || current < 0 || !stats.recent[current]) return null;
  const item = stats.recent[current];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-36 left-4 z-[110] flex max-w-[85vw] items-center gap-2.5 rounded-2xl border border-clay/40 bg-cream/95 py-2.5 pl-3 pr-3.5 text-ink shadow-[var(--shadow-card)] backdrop-blur transition-all duration-500 sm:max-w-xs lg:bottom-28 lg:left-6 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage/15 text-success">
        <Sparkles size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold">
          {roomLabel(item.roomType)}{styleLabel(item.style)} طراحی شد
        </div>
        <div className="text-2xs text-ink-muted">{agoText(item.minutesAgo)} با هومینو استودیو</div>
      </div>
      <button
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem("homeino:activity-dismissed", "1");
          } catch { /* private mode */ }
        }}
        className="shrink-0 text-ink-muted transition hover:text-ink"
        aria-label="بستن اعلان فعالیت"
      >
        <X size={14} />
      </button>
    </div>
  );
}
