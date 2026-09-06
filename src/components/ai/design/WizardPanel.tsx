"use client";
// ============================================================
// HOMINO STUDIO — Plan D (hybrid): the guided 3-step wizard.
// ① عکس ② سبک ③ وسایل + بودجه و اجرا
// Completed steps collapse into summary chips (click to re-open),
// steps open/close with a soft height animation. Every control keeps
// its original component — nothing was removed, only re-arranged.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { cn, toFa } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { RoomUploader } from "./RoomUploader";
import { StylePicker } from "./StylePicker";
import { ItemPicker } from "./ItemPicker";
import { BudgetStep } from "./BudgetStep";

type StepId = 1 | 2 | 3;

const EASE = [0.16, 1, 0.3, 1] as const;

export function WizardPanel({ studio }: { studio: DesignStudio }) {
  const { imageBase64, styleLabel, designElements, budget, skuInput, placements, loading, total } = studio;
  const [openStep, setOpenStep] = useState<StepId | null>(1);
  const prevPlacements = useRef(0);
  const hadImage = useRef(false);

  // After upload → softly auto-advance to the style step (once per photo).
  useEffect(() => {
    if (imageBase64 && !hadImage.current && openStep === 1) setOpenStep(2);
    hadImage.current = Boolean(imageBase64);
  }, [imageBase64, openStep]);

  // A fresh render → collapse the wizard into summary chips (canvas takes over).
  useEffect(() => {
    if (placements.length > 0 && prevPlacements.current === 0) setOpenStep(null);
    prevPlacements.current = placements.length;
  }, [placements.length]);

  const itemsLabel = designElements.length > 0
    ? `${toFa(designElements.length)} گروه وسایل${total > 0 ? ` · ${toFa(total.toLocaleString("en-US"))} ت` : ""}`
    : "چیدمان پیش‌فرض هومینو";

  const steps: { id: StepId; label: string; hint: string; done: boolean; summary: string }[] = [
    { id: 1, label: "عکس خانه", hint: "اتاقی که می‌خواهی تغییر کند", done: Boolean(imageBase64), summary: "عکس آپلود شد" },
    { id: 2, label: "سبک دکوراسیون", hint: "حال‌وهوای طراحی", done: true, summary: `سبک: ${styleLabel}` },
    {
      id: 3, label: "وسایل و اجرا", hint: "چه چیزی جای چه چیزی بشود", done: placements.length > 0,
      summary: itemsLabel + (budget ? ` · بودجه ${toFa(budget)} ت` : "") + (skuInput ? " · کد کالا" : ""),
    },
  ];

  return (
    <div className="rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)] sm:p-5">
      {/* Progress rail — one compact row */}
      <div className="mb-1 flex items-center gap-1" aria-hidden>
        {steps.map((s, i) => {
          const active = openStep === s.id;
          const state = s.done && !active ? "done" : active ? "active" : "todo";
          return (
            <div key={s.id} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => setOpenStep(active ? null : s.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full py-1 pl-2 pr-1.5 text-xs font-bold transition",
                  state === "done" && "bg-success/10 text-success",
                  state === "active" && "bg-ink text-cream",
                  state === "todo" && "text-ink-muted hover:text-ink",
                )}
              >
                <span className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-2xs font-black transition",
                  state === "done" && "bg-success text-white",
                  state === "active" && "bg-cream text-ink",
                  state === "todo" && "border border-clay bg-ivory-2",
                )}>{s.done && !active ? <Check size={11} /> : toFa(s.id)}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full transition-colors", steps[i].done ? "bg-success/40" : "bg-clay/40")} />}
            </div>
          );
        })}
      </div>

      {/* Step bodies / summaries */}
      <div className="space-y-2">
        {steps.map((s) => {
          const open = openStep === s.id;
          return (
            <div key={s.id} className={cn("rounded-xl border transition-colors", open ? "border-terracotta/40 bg-ivory-2/60" : "border-clay/40 bg-ivory-2/40")}>
              {/* Always-visible step header */}
              <button
                onClick={() => setOpenStep(open ? null : s.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-right"
                aria-expanded={open}
              >
                <span className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold transition",
                  s.done && !open ? "bg-success/15 text-success" : "bg-ink text-cream",
                )}>{s.done && !open ? <Check size={14} /> : toFa(s.id)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{s.label}</span>
                  <span className={cn("block truncate text-xs transition-colors", open ? "text-ink-muted" : "text-terracotta-deep")}>
                    {open ? s.hint : s.summary}
                  </span>
                </span>
                {!open && (s.done || s.id === 2) && <Pencil size={12} className="shrink-0 text-ink-muted" />}
                <ChevronDown size={15} className={cn("shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
              </button>

              {/* Collapsible body — soft open/close */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.34, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3.5">
                      {s.id === 1 && <RoomUploader studio={studio} />}
                      {s.id === 2 && <StylePicker studio={studio} />}
                      {s.id === 3 && (
                        <div className="space-y-3">
                          <ItemPicker studio={studio} />
                          <BudgetStep studio={studio} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {loading && <p className="mt-3 text-center text-xs text-ink-muted">استودیو مشغول اجراست — پیشرفت در پنل خروجی دیده می‌شود</p>}
    </div>
  );
}
