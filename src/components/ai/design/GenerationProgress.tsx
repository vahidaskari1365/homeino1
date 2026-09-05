"use client";
// در حال تولید — مرحله‌ها + پیام خطا (verbatim JSX از /ai/design).
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { STAGE_LABEL, progressSteps } from "./constants";

export function GenerationProgress({ studio }: { studio: DesignStudio }) {
  const { loading, stage, error, generate } = studio;
  return (
    <>
      {loading && (
        <div className="rounded-xl border border-clay/50 bg-cream p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs"><Loader2 size={14} className="animate-spin text-terracotta-deep" /><span className="font-medium text-ink">{STAGE_LABEL[stage]}</span></div>
          <div className="space-y-1">{progressSteps(stage).map((s) => (<div key={s.key} className="flex items-center gap-2"><div className="shrink-0">{s.done ? <Check size={12} className="text-success" /> : s.active ? <Loader2 size={12} className="animate-spin text-terracotta-deep" /> : <span className="block h-3 w-3 rounded-full border border-clay" />}</div><span className={cn("text-[10px]", s.done ? "text-success" : s.active ? "font-medium text-ink" : "text-ink-muted")}>{s.label}</span></div>))}</div>
        </div>
      )}
      {error && !loading && <div className="rounded-xl border border-danger/30 bg-danger/5 p-2.5 text-[11px] text-danger"><p className="font-bold">{error}</p><button onClick={generate} className="mt-0.5 font-bold text-terracotta-deep hover:underline">تلاش مجدد</button></div>}
    </>
  );
}
