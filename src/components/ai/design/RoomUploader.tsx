"use client";
// Step ۱ — «عکس خانه» upload card. The Homeino Studio analysis now renders
// DIRECTLY BELOW the uploaded photo (owner request), inside this same card.
import { useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import type { DesignStudio } from "./useDesignStudio";
import { panelCls, stepBadge } from "./constants";
import { AnalysisBanner } from "./AnalysisBanner";

export function RoomUploader({ studio }: { studio: DesignStudio }) {
  const { imageBase64, analyzing, handleFile, removeImage } = studio;
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={panelCls}>
      <h2 className="mb-2.5 flex items-center gap-2 border-b border-clay/30 pb-2.5 text-base font-bold text-ink"><span className={stepBadge}>۱</span> عکس خانه</h2>
      {!imageBase64 ? (
        <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 text-center transition hover:border-terracotta">
          <Upload size={28} className="mb-2 text-ink-muted" /><p className="text-sm font-medium text-ink">عکس اتاقت را بنداز اینجا</p><p className="mt-0.5 text-xs text-ink-muted">یا کلیک کن برای انتخاب — JPG / PNG / WEBP</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-clay/40">
          <img src={imageBase64} alt="عکس اتاق شما" className="aspect-video w-full object-cover" />
          <button onClick={removeImage} className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/80 text-cream transition hover:bg-danger" aria-label="حذف عکس"><X size={15} /></button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {analyzing && <p className="mt-2.5 flex items-center gap-1.5 text-sm text-ink-muted"><Loader2 size={15} className="animate-spin text-terracotta-deep" /> در حال تحلیل هومینو استودیو...</p>}
      {/* تحلیل هومینو استودیو — مستقیماً زیر عکس آپلودشده */}
      {imageBase64 && !analyzing && <AnalysisBanner studio={studio} embedded />}
    </div>
  );
}
