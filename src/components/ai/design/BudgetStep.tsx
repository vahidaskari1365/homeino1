"use client";
// «کد کالا / SKU» + «بودجه و دستور» + دکمه تولید + هزینه (verbatim JSX).
import { AlertCircle, Wand2 } from "lucide-react";
import { toFa } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";

export function BudgetStep({ studio }: { studio: DesignStudio }) {
  const { skuInput, handleSkuChange, skuWarning, budget, setBudget, prompt, setPrompt, generate, loading, imageBase64, designElements, cost } = studio;
  return (
    <>
      {/* SKU / Product Code Input */}
      <div className="rounded-xl border border-clay/50 bg-cream p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold text-ink-muted">کد کالا / SKU (اختیاری)</span>
          {skuInput && (
            <button onClick={() => handleSkuChange("")} className="text-[9px] text-ink-muted hover:text-danger">
              حذف کد
            </button>
          )}
        </div>
        <input
          value={skuInput}
          onChange={(e) => handleSkuChange(e.target.value)}
          placeholder="مثلاً SKU-SOFA-01 یا CHR-3011..."
          dir="ltr"
          className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-terracotta"
        />
        {skuWarning && (
          <p className="mt-1.5 flex items-center gap-1 text-[9px] font-medium text-warning">
            <AlertCircle size={11} className="shrink-0 text-warning" />
            <span>{skuWarning}</span>
          </p>
        )}
      </div>

      {/* Budget + Prompt */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-clay/50 bg-cream p-3"><span className="mb-1 block text-[10px] font-bold text-ink-muted">بودجه</span><input type="text" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} placeholder="تومان" dir="ltr" className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-terracotta" /></div>
        <div className="rounded-xl border border-clay/50 bg-cream p-3"><span className="mb-1 block text-[10px] font-bold text-ink-muted">دستور به AI (اختیاری)</span><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثلاً نور گرم‌تر..." className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-terracotta" /></div>
      </div>

      {/* Generate */}
      <button onClick={generate} disabled={loading || !imageBase64} className="btn-accent flex w-full items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-40"><Wand2 size={16} /> {designElements.length > 0 ? "ببین چطور تو خونه‌ات می‌شه" : "طراحی اتاق من"}</button>
      <div className="flex items-center justify-between rounded-lg border border-clay/40 bg-cream px-3 py-1.5 text-[10px] text-ink-muted"><span>هزینه</span><span className="font-bold text-gold">{toFa(cost)} اعتبار</span></div>
    </>
  );
}
