"use client";
// «کد کالا / SKU» + «بودجه و دستور» — دکمهٔ تولید و هزینه الان در
// CTA چسبانِ StudioSettings است (الگوی رقبا: یک CTA، همیشه در دید).
import { AlertCircle } from "lucide-react";
import type { DesignStudio } from "./useDesignStudio";

export function BudgetStep({ studio }: { studio: DesignStudio }) {
  const { skuInput, handleSkuChange, skuWarning, budget, setBudget, prompt, setPrompt } = studio;
  return (
    <div className="space-y-3">
      {/* SKU / Product Code Input */}
      <div className="rounded-xl border border-clay/50 bg-ivory-2/70 p-3.5">
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
        <div className="rounded-xl border border-clay/50 bg-ivory-2/70 p-3.5"><span className="mb-1.5 block text-xs font-bold text-ink-muted">بودجه (تومان)</span><input type="text" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} placeholder="تومان" dir="ltr" className="w-full rounded-lg border border-clay/50 bg-cream px-3 py-2.5 text-sm text-ink outline-none focus:border-terracotta" /></div>
        <div className="rounded-xl border border-clay/50 bg-ivory-2/70 p-3.5"><span className="mb-1.5 block text-xs font-bold text-ink-muted">دستور به استودیو (اختیاری)</span><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثلاً نور گرم‌تر..." className="w-full rounded-lg border border-clay/50 bg-cream px-3 py-2.5 text-sm text-ink outline-none focus:border-terracotta" /></div>
      </div>
    </div>
  );
}
