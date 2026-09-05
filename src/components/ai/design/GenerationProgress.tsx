"use client";
// در حال تولید — مرحله‌ها + پیام خطا (readable sizes).
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { STAGE_LABEL, progressSteps } from "./constants";

export function GenerationProgress({ studio }: { studio: DesignStudio }) {
  const { loading, stage, error, generate } = studio;
  return (
    <>
      {loading && (
        <div className="rounded-xl border border-clay/50 bg-cream p-4">
          <div className="mb-2.5 flex items-center gap-2 text-sm"><Loader2 size={17} className="animate-spin text-terracotta-deep" /><span className="font-bold text-ink">{STAGE_LABEL[stage]}</span></div>
          <div className="space-y-1.5">{progressSteps(stage).map((s) => (<div key={s.key} className="flex items-center gap-2"><div className="shrink-0">{s.done ? <Check size={14} className="text-success" /> : s.active ? <Loader2 size={14} className="animate-spin text-terracotta-deep" /> : <span className="block h-3.5 w-3.5 rounded-full border border-clay" />}</div><span className={cn("text-xs", s.done ? "text-success" : s.active ? "font-bold text-ink" : "text-ink-muted")}>{s.label}</span></div>))}</div>
        </div>
      )}
      {error && !loading && <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"><p className="font-bold">{error}</p><button onClick={generate} className="mt-1 font-bold text-terracotta-deep hover:underline">تلاش مجدد</button></div>}
    </>
  );
}
