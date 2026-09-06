"use client";
// تحلیل اتاق + پیشنهادهای هومینو استودیو.
// embedded = مستقیم زیر عکس آپلودشده (داخل کارت «عکس خانه»)؛
// حالت کارت مستقل فقط برای استفاده‌های آینده نگه داشته شده است.
import { Sparkles } from "lucide-react";
import { toFa } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";

export function AnalysisBanner({ studio, embedded = false }: { studio: DesignStudio; embedded?: boolean }) {
  const { roomAnalysis, applySuggestion, customizeSuggestion } = studio;
  if (!roomAnalysis) return null;
  return (
    <div className={embedded ? "mt-3 rounded-xl border border-clay/40 bg-ivory-2 p-3.5" : "mb-4 rounded-xl border border-clay/40 bg-cream p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta/10 text-terracotta-deep"><Sparkles size={16} /></span>
          <div>
            <span className="text-sm font-bold text-ink">تحلیل اتاق: {roomAnalysis.roomType || "نشیمن"} · سبک فعلی {roomAnalysis.style}</span>
            <span className="mr-2 text-xs text-ink-muted">(اطمینان {toFa(Math.round((roomAnalysis.confidence ?? 0.6) * 100))}٪)</span>
          </div>
        </div>
        {roomAnalysis.palette && roomAnalysis.palette.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-muted">پالت:</span>
            {roomAnalysis.palette.slice(0, 4).map((c, i) => <span key={i} className="rounded-full bg-cream px-2 py-0.5 text-xs text-ink ring-1 ring-clay/30">{c}</span>)}
          </div>
        )}
      </div>
      {roomAnalysis.opportunities && roomAnalysis.opportunities.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-clay/20 pt-2.5">
          <span className="text-xs text-ink-muted">فرصت‌ها:</span>
          {roomAnalysis.opportunities.slice(0, 3).map((op, i) => <span key={i} className="rounded bg-cream px-2 py-0.5 text-xs text-ink-muted ring-1 ring-clay/25">{op}</span>)}
        </div>
      )}
      {roomAnalysis.guidedSuggestions && roomAnalysis.guidedSuggestions.length > 0 && (
        <div className="mt-3 border-t border-clay/20 pt-2.5">
          <span className="mb-2 block text-sm font-bold text-terracotta-deep">پیشنهادهای هومینو استودیو:</span>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {roomAnalysis.guidedSuggestions.slice(0, 3).map((sg) => (
              <div key={sg.id} className="flex flex-col justify-between rounded-lg border border-clay/30 bg-cream p-2.5">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-ink">{sg.title}</span>
                    <span className="shrink-0 rounded bg-gold/15 px-1.5 py-0.5 text-2xs font-bold text-gold">{sg.category}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{sg.desc}</p>
                </div>
                <div className="mt-2 flex gap-1.5 border-t border-clay/20 pt-2">
                  <button onClick={() => applySuggestion(sg)} className="flex-1 rounded-md bg-ink px-2 py-1.5 text-xs font-bold text-cream transition hover:bg-terracotta-deep">اعمال</button>
                  <button onClick={() => customizeSuggestion(sg)} className="rounded-md border border-clay/40 bg-cream px-2 py-1.5 text-xs text-ink-muted transition hover:text-ink">شخصی‌سازی</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
