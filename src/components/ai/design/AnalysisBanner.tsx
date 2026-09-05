"use client";
// بنر «تحلیل اتاق + پیشنهادهای هوشمند» (verbatim JSX از /ai/design).
import { Sparkles } from "lucide-react";
import { toFa } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";

export function AnalysisBanner({ studio }: { studio: DesignStudio }) {
  const { roomAnalysis, applySuggestion, customizeSuggestion } = studio;
  if (!roomAnalysis) return null;
  return (
    <div className="mb-4 rounded-xl border border-clay/40 bg-cream p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-terracotta/10 text-terracotta-deep"><Sparkles size={12} /></span>
          <div>
            <span className="text-[11px] font-bold text-ink">تحلیل اتاق: {roomAnalysis.roomType || "نشیمن"} · سبک فعلی {roomAnalysis.style}</span>
            <span className="mr-2 text-[10px] text-ink-muted">(اطمینان {toFa(Math.round((roomAnalysis.confidence ?? 0.6) * 100))}٪)</span>
          </div>
        </div>
        {roomAnalysis.palette && roomAnalysis.palette.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-ink-muted">پالت:</span>
            {roomAnalysis.palette.slice(0, 4).map((c, i) => <span key={i} className="rounded-full bg-ivory-2 px-1.5 py-0.5 text-[8px] text-ink">{c}</span>)}
          </div>
        )}
      </div>
      {roomAnalysis.opportunities && roomAnalysis.opportunities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-clay/20 pt-2">
          <span className="text-[9px] text-ink-muted">فرصت‌ها:</span>
          {roomAnalysis.opportunities.slice(0, 3).map((op, i) => <span key={i} className="rounded bg-ivory-2 px-1.5 py-0.5 text-[9px] text-ink-muted">{op}</span>)}
        </div>
      )}
      {roomAnalysis.guidedSuggestions && roomAnalysis.guidedSuggestions.length > 0 && (
        <div className="mt-2.5 border-t border-clay/20 pt-2">
          <span className="mb-1.5 block text-[10px] font-bold text-terracotta-deep">پیشنهادهای هوشمند AI:</span>
          <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {roomAnalysis.guidedSuggestions.slice(0, 3).map((sg) => (
              <div key={sg.id} className="flex flex-col justify-between rounded-lg border border-clay/30 bg-ivory-2 p-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink">{sg.title}</span>
                    <span className="rounded bg-gold/15 px-1 py-0.2 text-[8px] font-bold text-gold">{sg.category}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-ink-muted">{sg.desc}</p>
                </div>
                <div className="mt-1.5 flex gap-1 pt-1 border-t border-clay/20">
                  <button onClick={() => applySuggestion(sg)} className="flex-1 rounded bg-ink px-1.5 py-0.5 text-[8px] font-bold text-cream transition hover:bg-terracotta-deep">اعمال</button>
                  <button onClick={() => customizeSuggestion(sg)} className="rounded border border-clay/40 bg-cream px-1.5 py-0.5 text-[8px] text-ink-muted hover:text-ink">شخصی‌سازی</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
