"use client";
// Step ۲ — سبک دکوراسیون به‌صورت «نوار افقی» (طرح D):
// یک ردیف کارت‌های بزرگ با اسکرول نرم و دو فلش؛ RTL-پسند.
import { useRef } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { STYLES } from "./constants";

export function StylePicker({ studio }: { studio: DesignStudio }) {
  const { style, selectStyle } = studio;
  const railRef = useRef<HTMLDivElement>(null);
  // RTL: «بعدی» یعنی حرکت به چپ (scroll منفی)، «قبلی» به راست.
  const nudge = (dx: number) => railRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-ink-muted">۹ سبک — بکش و انتخاب کن</p>
        <div className="flex gap-1">
          <button onClick={() => nudge(264)} aria-label="سبک‌های قبلی" className="grid h-7 w-7 place-items-center rounded-full border border-clay/50 bg-cream text-ink-muted transition hover:border-terracotta/60 hover:text-terracotta-deep"><ChevronRight size={14} /></button>
          <button onClick={() => nudge(-264)} aria-label="سبک‌های بعدی" className="grid h-7 w-7 place-items-center rounded-full border border-clay/50 bg-cream text-ink-muted transition hover:border-terracotta/60 hover:text-terracotta-deep"><ChevronLeft size={14} /></button>
        </div>
      </div>
      <div
        ref={railRef}
        className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {STYLES.map((s) => {
          const on = style === s.id;
          return (
            <button
              key={s.id}
              onClick={() => selectStyle(s.id)}
              aria-pressed={on}
              className={cn(
                "group relative w-24 shrink-0 snap-start overflow-hidden rounded-xl border text-center transition sm:w-28",
                on ? "border-terracotta ring-2 ring-terracotta/40" : "border-clay/40 hover:border-terracotta/50",
              )}
            >
              <div className="relative aspect-[4/5]">
                <img src={s.image} alt={`سبک ${s.label}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent px-1.5 pb-1.5 pt-6">
                  <p className={cn("truncate text-xs font-bold", on ? "text-cream" : "text-cream/90")}>{s.label}</p>
                </div>
                {on && (
                  <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-terracotta text-white shadow-md">
                    <Check size={13} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">سبک فعال: <b className="text-terracotta-deep">{STYLES.find((s) => s.id === style)?.label ?? style}</b> — هر وقت خواستی عوضش کن.</p>
    </div>
  );
}
