"use client";
// «کد کالا / SKU» + «بودجه و دستور» + دکمه تولید + هزینه (readable sizes).
import { AlertCircle, Wand2 } from "lucide-react";
import { toFa } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";

export function BudgetStep({ studio }: { studio: DesignStudio }) {
  const { skuInput, handleSkuChange, skuWarning, budget, setBudget, prompt, setPrompt, generate, loading, imageBase64, designElements, cost } = studio;
  return (
    <>
      {/* SKU / Product Code Input */}
      <div className="rounded-xl border border-clay/50 bg-cream p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-bold text-ink-muted">کد کالا / SKU (اختیاری)</span>
          {skuInput && (
            <button onClick={() => handleSkuChange("")} className="text-xs text-ink-muted hover:text-danger">
              حذف کد
            </button>
          )}
        </div>
        <input
          value={skuInput}
          onChange={(e) => handleSkuChange(e.target.value)}
          placeholder="مثلاً SKU-SOFA-01 یا CHR-3011..."
          dir="ltr"
          className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-terracotta"
        />
        {skuWarning && (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-warning">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" />
            <span>{skuWarning}</span>
          </p>
        )}
      </div>

      {/* Budget + Prompt */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-clay/50 bg-cream p-4"><span className="mb-1.5 block text-xs font-bold text-ink-muted">بودجه (تومان)</span><input type="text" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} placeholder="تومان" dir="ltr" className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-terracotta" /></div>
        <div className="rounded-xl border border-clay/50 bg-cream p-4"><span className="mb-1.5 block text-xs font-bold text-ink-muted">دستور به استودیو (اختیاری)</span><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثلاً نور گرم‌تر..." className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-terracotta" /></div>
      </div>

      {/* Generate */}
      <button onClick={generate} disabled={loading || !imageBase64} className="btn-accent flex w-full items-center justify-center gap-2 py-4 text-base font-bold disabled:opacity-40"><Wand2 size={19} /> {designElements.length > 0 ? "ببین چطور تو خونه‌ات می‌شه" : "طراحی اتاق من"}</button>
      <div className="flex items-center justify-between rounded-lg border border-clay/40 bg-cream px-3 py-2 text-xs text-ink-muted"><span>هزینه</span><span className="font-bold text-gold">{toFa(cost)} اعتبار</span></div>
    </>
  );
}
