"use client";
// ============================================================
// «کانواس عکس» — قلب صفحه، به سبک رقبای موفق (RoomGPT / Decoratly /
// REimagineHome): عکس قهرمان است و تحلیل، لحظهٔ جادوییِ بعد از آپلود.
// • بدون عکس: دراپ‌زون بزرگ + «نمونهٔ آماده» (الگوی Decoratly)
// • لحظهٔ آپلود: انیمیشن اسکن تحلیل روی خود عکس
// • بعد از تحلیل: چیپ‌های نتیجه روی عکس + کارت تحلیل کامل زیر عکس —
//   همیشه باز و همیشه دیده‌شونده (باگ نسخهٔ قبل: تحلیل داخل مرحلهٔ
//   ویزارد جمع می‌شد و اصلاً دیده نمی‌شد — اشکالی که مالک گزارش کرد)
// ============================================================
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Loader2, ScanLine, Replace, ImagePlus } from "lucide-react";
import { toFa, cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { AnalysisBanner } from "./AnalysisBanner";

/** سه نمونهٔ آمادهٔ محلی (بدون نیاز به عکس — الگوی «Try a sample room») */
export const SAMPLE_ROOMS = [
  { src: "/images/samples/room-1.jpg", label: "نشیمن روشن" },
  { src: "/images/samples/room-2.jpg", label: "نشیمن مدرن" },
  { src: "/images/samples/room-3.jpg", label: "نشیمن مینیمال" },
];

export function RoomUploader({ studio }: { studio: DesignStudio }) {
  const { imageBase64, analyzing, handleFile, removeImage, roomAnalysis, loadSample } = studio;
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------- حالت خالی: دراپ‌زون + نمونه‌ها ----------
  if (!imageBase64) {
    return (
      <div>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-clay/60 bg-ivory-2/60 text-center transition hover:border-terracotta hover:bg-ivory-2"
        >
          <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-cream text-terracotta-deep shadow-[var(--shadow-soft)]"><Upload size={26} /></span>
          <p className="text-base font-bold text-ink">عکس اتاقت را بنداز اینجا</p>
          <p className="mt-1 text-xs text-ink-muted">یا کلیک کن برای انتخاب — JPG / PNG / WEBP · حداکثر ۱۰ مگ</p>
          <p className="mt-3 flex items-center gap-1.5 text-2xs text-ink-muted"><ScanLine size={13} className="text-terracotta-deep" /> بلافاصله بعد از آپلود، هومینو عکس را تحلیل می‌کند</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

        <div className="mt-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-muted"><ImagePlus size={13} /> عکس نداری؟ با یک نمونه امتحان کن:</p>
          <div className="grid grid-cols-3 gap-2">
            {SAMPLE_ROOMS.map((s) => (
              <button key={s.src} onClick={() => loadSample(s.src)} className="group relative overflow-hidden rounded-xl border border-clay/40 transition hover:border-terracotta/60">
                <img src={s.src} alt={`نمونه ${s.label}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 to-transparent px-1.5 pb-1 pt-4 text-right text-2xs font-bold text-cream">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- عکس هست: قهرمان + تحلیل ----------
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-clay/40 bg-ink">
        <img src={imageBase64} alt="عکس اتاق شما" className="aspect-video w-full object-cover" />

        {/* اسکن تحلیل — انیمیشن روی خود عکس (لحظهٔ جادویی) */}
        <AnimatePresence>
          {analyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]">
              <motion.span
                initial={{ top: "0%" }}
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-terracotta/40 to-transparent"
                aria-hidden
              />
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-ink/80 px-4 py-2 text-sm font-bold text-cream backdrop-blur">
                  <Loader2 size={15} className="animate-spin text-gold" />
                  هومینو در حال تحلیل عکس توست…
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* چیپ‌های نتیجهٔ تحلیل — روی خود عکس */}
        {!analyzing && roomAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1.5"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-bold text-cream backdrop-blur">
              <ScanLine size={12} className="text-gold" />
              {roomAnalysis.roomType || "نشیمن"} · {roomAnalysis.style}
            </span>
            <span className="rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-cream/90 backdrop-blur">اطمینان {toFa(Math.round((roomAnalysis.confidence ?? 0.6) * 100))}٪</span>
            {(roomAnalysis.palette ?? []).slice(0, 3).map((c, i) => (
              <span key={i} className="hidden rounded-full bg-ink/70 px-2.5 py-1 text-xs text-cream/90 backdrop-blur sm:inline">{c}</span>
            ))}
          </motion.div>
        )}

        {/* حذف / تعویض عکس */}
        <button onClick={removeImage} className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/80 text-cream transition hover:bg-danger" aria-label="حذف عکس"><X size={15} /></button>
        <button onClick={() => inputRef.current?.click()} className={cn("absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-cream backdrop-blur transition hover:bg-terracotta-deep", analyzing && "pointer-events-none opacity-50")} aria-label="تعویض عکس"><Replace size={13} /> تعویض</button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {/* تحلیل کامل هومینو — همیشه زیر عکس، همیشه باز (اولویت مالک) */}
      {analyzing && (
        <div className="mt-3 space-y-2 rounded-xl border border-clay/40 bg-ivory-2/60 p-3.5" aria-hidden>
          <div className="h-4 w-2/3 animate-pulse rounded bg-clay/40" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-clay/30" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-clay/30" />
          <p className="flex items-center gap-1.5 pt-1 text-xs text-ink-muted"><Loader2 size={13} className="animate-spin text-terracotta-deep" /> نوع اتاق، سبک فعلی، پالت رنگ و فرصت‌ها دارد مشخص می‌شود…</p>
        </div>
      )}
      {!analyzing && roomAnalysis && <AnalysisBanner studio={studio} embedded />}
    </div>
  );
}
