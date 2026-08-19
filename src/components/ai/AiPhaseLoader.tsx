"use client";
// ============================================================
// AI PHASE LOADER — the premium loading experience.
// Rendered for every busy phase so the page NEVER looks empty
// or frozen: staged stepper + progress bar + rotating tips.
// ============================================================
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { PIPELINE_STEPS, AI_WAIT_TIPS, stepIndexForPhase, type AiPhase } from "@/services/ai/states";
import { toFa, cn } from "@/lib/utils";

export function AiPhaseLoader({ phase, note }: { phase: AiPhase; note?: string }) {
  const activeStep = stepIndexForPhase(phase);
  const [tipIndex, setTipIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % AI_WAIT_TIPS.length), 3800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // The loader mounts fresh per run, so `elapsed` always starts at 0.
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-clay/50 bg-cream shadow-[var(--shadow-soft)]" role="status" aria-live="polite">
      {/* aurora shimmer backdrop */}
      <div className="pointer-events-none absolute inset-0 grain opacity-25" />
      <div className="pointer-events-none absolute -right-[15%] -top-[60%] h-[120%] w-[70%] animate-[aurora_9s_ease-in-out_infinite_alternate] bg-[radial-gradient(closest-side,rgba(30,93,68,0.16),transparent)]" />
      <div className="pointer-events-none absolute -left-[15%] bottom-[-60%] h-[120%] w-[60%] animate-[aurora_11s_ease-in-out_infinite_alternate-reverse] bg-[radial-gradient(closest-side,rgba(201,111,74,0.14),transparent)]" />

      <div className="relative p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-ink text-cream">
              <Loader2 size={20} className="animate-spin" />
              <span className="absolute inset-0 animate-ping rounded-2xl bg-ink/20" />
            </span>
            <div>
              <p className="font-display text-base font-black text-ink">طراحی‌ات ساخته می‌شود</p>
              <p className="text-[11px] text-ink-muted">{note ?? "چند لحظه صبر کن — هیچ‌چیز بدون اجازه‌ی تو تغییر نمی‌کند."}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-ivory-2 px-2.5 py-1 text-[11px] font-bold tabular-nums text-ink-muted" dir="ltr">
            {toFa(String(Math.floor(elapsed / 60)).padStart(2, "0"))}:{toFa(String(elapsed % 60).padStart(2, "0"))}
          </span>
        </div>

        {/* stepper */}
        <ol className="space-y-2.5">
          {PIPELINE_STEPS.map((step, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <li key={step.key} className={cn("flex items-center gap-2.5 transition", done ? "opacity-70" : active ? "opacity-100" : "opacity-40")}>
                <span className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition",
                  done ? "border-success bg-success text-white" : active ? "border-ink bg-ink text-cream" : "border-clay bg-ivory-2 text-ink-muted",
                )}>
                  {done ? <Check size={12} /> : active ? <Loader2 size={11} className="animate-spin" /> : toFa(i + 1)}
                </span>
                <span className={cn("text-xs", active ? "font-bold text-ink" : "font-medium text-ink-muted")}>{step.label}</span>
                {active && (
                  <span className="mr-2 flex flex-1 overflow-hidden">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-clay/30">
                      <span className="block h-full w-1/3 animate-[slideLoading_1.4s_ease-in-out_infinite] rounded-full bg-terracotta" />
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* rotating tip */}
        <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 px-3.5 py-2.5 text-[11px] leading-6 text-ink-muted">
          <span key={tipIndex} className="animate-[fadeUp_0.5s_ease]">💡 {AI_WAIT_TIPS[tipIndex]}</span>
        </div>
      </div>
    </div>
  );
}
