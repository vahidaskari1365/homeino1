"use client";
// Step ۲ — «سبک دکوراسیون» picker card (JSX moved verbatim from /ai/design).
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { STYLES, panelCls, stepBadge } from "./constants";

export function StylePicker({ studio }: { studio: DesignStudio }) {
  const { style, selectStyle } = studio;
  return (
    <div className={panelCls}>
      <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><span className={stepBadge}>۲</span> سبک دکوراسیون</h2>
      <div className="grid grid-cols-5 gap-1.5">
        {STYLES.map((s) => (
          <button key={s.id} onClick={() => selectStyle(s.id)} className={cn("overflow-hidden rounded-lg border text-center transition", style === s.id ? "border-terracotta ring-1 ring-terracotta/40" : "border-clay/40 hover:border-terracotta/50")}>
            <div className="relative aspect-square"><img src={s.image} alt={s.label} className="h-full w-full object-cover" />{style === s.id && <span className="absolute inset-0 grid place-items-center bg-terracotta/20"><Check size={14} className="text-white" /></span>}</div>
            <p className="bg-ivory-2 py-0.5 text-[9px] font-bold text-ink">{s.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
