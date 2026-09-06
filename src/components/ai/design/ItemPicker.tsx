"use client";
// Step ۳ — «انتخاب وسایل» به‌صورت «پاپ‌آپ چیپ» (طرح D):
// هر دسته یک چیپ است؛ با کلیک، یک پاپ‌آپ شناور باز می‌شود و
// زیرمجموعه‌ها + توضیح هر کدام همان‌جا انتخاب می‌شوند. فقط یک
// پاپ‌آپ باز می‌ماند؛ کلیک بیرون می‌بندد. هیچ دسته‌ای حذف نشده —
// همان ۱۳ دسته با همان زیرمجموعه‌ها.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Lightbulb, X } from "lucide-react";
import { toFa, cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { CATEGORIES } from "./constants";

export function ItemPicker({ studio }: { studio: DesignStudio }) {
  const { openCats, selectedSubTypes, setSelectedSubTypes, toggleSubType } = studio;
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const prevOpenCats = useRef<Set<string>>(openCats);

  // applySuggestion / selectStyle("office") دسته‌ای را به openCats اضافه می‌کنند
  // → همان دسته خودکار باز می‌شود (رفتار قبلی آکاردئون حفظ شده).
  useEffect(() => {
    for (const slug of openCats) {
      if (!prevOpenCats.current.has(slug)) { setOpenSlug(slug); break; }
    }
    prevOpenCats.current = openCats;
  }, [openCats]);

  const totalSel = Object.values(selectedSubTypes).reduce((n, arr) => n + arr.length, 0);
  const activeCat = openSlug ? CATEGORIES.find((c) => c.slug === openSlug) : null;
  const activeSel = activeCat ? selectedSubTypes[activeCat.slug] || [] : [];

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const selCount = (selectedSubTypes[c.slug] || []).length;
          const active = openSlug === c.slug;
          return (
            <button
              key={c.slug}
              onClick={() => setOpenSlug(active ? null : c.slug)}
              aria-expanded={active}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition",
                active
                  ? "border-terracotta bg-terracotta/10 text-terracotta-deep"
                  : selCount > 0
                    ? "border-terracotta/50 bg-ivory-2 text-terracotta-deep"
                    : "border-clay/40 bg-ivory-2 text-ink-muted hover:border-terracotta/50 hover:text-ink",
              )}
            >
              <c.Icon size={14} className="shrink-0" />
              <span className="line-clamp-1">{c.label}</span>
              {selCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-terracotta px-1 text-2xs font-black text-white">{toFa(selCount)}</span>}
              <ChevronDown size={11} className={cn("shrink-0 opacity-60 transition-transform", active && "rotate-180")} />
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {activeCat && (
          <>
            <div className="fixed inset-0 z-20 cursor-default" onClick={() => setOpenSlug(null)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-x-0 z-30 mt-2 rounded-xl border border-clay/60 bg-cream p-3 shadow-[0_18px_44px_-14px_rgba(62,38,20,0.35)]"
              role="dialog"
              aria-label={`انتخاب ${activeCat.label}`}
            >
              <div className="mb-2.5 flex items-center justify-between border-b border-clay/25 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-terracotta-deep">
                  <activeCat.Icon size={14} /> {activeCat.label}
                  {activeSel.length > 0 && <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-2xs text-white">{toFa(activeSel.length)} انتخاب</span>}
                </span>
                <span className="flex items-center gap-2">
                  {activeSel.length > 0 && (
                    <button onClick={() => setSelectedSubTypes((s) => ({ ...s, [activeCat.slug]: [] }))} className="text-xs text-ink-muted hover:text-danger">پاک کردن</button>
                  )}
                  <button onClick={() => setOpenSlug(null)} className="grid h-6 w-6 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="بستن"><X size={13} /></button>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeCat.subTypes.map((st) => {
                  const on = activeSel.includes(st.label);
                  return (
                    <button
                      key={st.label}
                      onClick={() => toggleSubType(activeCat.slug, st.label)}
                      aria-pressed={on}
                      title={st.desc}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold transition",
                        on ? "border-terracotta bg-terracotta text-white" : "border-clay/50 bg-ivory-2 text-ink-muted hover:border-terracotta/50 hover:text-ink",
                      )}
                    >
                      {on && <Check size={11} />} {st.label}
                    </button>
                  );
                })}
              </div>
              {activeSel.length > 0 && (
                <div className="mt-2.5 space-y-1 rounded-lg bg-ivory-2 p-2.5">
                  {activeSel.map((label) => {
                    const st = activeCat.subTypes.find((x) => x.label === label);
                    return (
                      <div key={label} className="flex gap-1.5 text-xs leading-5 text-ink-muted">
                        <Lightbulb size={12} className="mt-0.5 shrink-0 text-gold" />
                        <span><b className="text-ink">{label}:</b> {st?.desc}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <p className="mt-2 text-xs leading-5 text-ink-muted">
        {totalSel > 0
          ? `${toFa(totalSel)} گروه وسایل انتخاب شده — هر چیپ یک دسته است، برای تغییر کلیک کن.`
          : "روی هر چیپ بزن و وسایل موردنظرت را تیک بزن — یا بدون انتخاب، هومینو یک چیدمان کامل پیش‌فرض می‌چیند."}
      </p>
    </div>
  );
}
