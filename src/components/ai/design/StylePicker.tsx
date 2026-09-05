"use client";
// Step ۲ — «سبک دکوراسیون» picker card (readable sizes).
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { STYLES, panelCls, stepBadge } from "./constants";

export function StylePicker({ studio }: { studio: DesignStudio }) {
  const { style, selectStyle } = studio;
  return (
    <div className={panelCls}>
      <h2 className="mb-3 flex items-center gap-2 border-b border-clay/30 pb-2.5 text-base font-bold text-ink"><span className={stepBadge}>۲</span> سبک دکوراسیون</h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {STYLES.map((s) => (
          <button key={s.id} onClick={() => selectStyle(s.id)} className={cn("overflow-hidden rounded-lg border text-center transition", style === s.id ? "border-terracotta ring-2 ring-terracotta/40" : "border-clay/40 hover:border-terracotta/50")}>
            <div className="relative aspect-square"><img src={s.image} alt={s.label} className="h-full w-full object-cover" />{style === s.id && <span className="absolute inset-0 grid place-items-center bg-terracotta/20"><Check size={18} className="text-white" /></span>}</div>
            <p className="bg-ivory-2 py-1 text-xs font-bold text-ink">{s.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
