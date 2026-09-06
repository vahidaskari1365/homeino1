"use client";
// ============================================================
// INTENT CARD — shows WHAT the AI understood BEFORE generating.
// The user can correct the reading by toggling target chips;
// the pipeline will only ever change confirmed targets.
// ============================================================
import { BrainCircuit, Lock, Loader2, AlertTriangle, Wand2 } from "lucide-react";
import type { IntentAnalysis } from "@/services/ai/llm/types";
import { INTENT_LABELS } from "@/services/ai/llm/types";
import { ALL_ELEMENTS, ELEMENT_LABELS, type RoomElement } from "@/services/ai/roomState";
import { toFa, cn } from "@/lib/utils";

export function IntentCard({
  analysis,
  understanding,
  onToggleTarget,
}: {
  analysis: IntentAnalysis | null;
  understanding: boolean;
  /** Toggle an element in the confirmed target set (user correction). */
  onToggleTarget?: (el: RoomElement) => void;
}) {
  if (!analysis) {
    if (understanding) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-clay/40 bg-cream px-3.5 py-2.5 text-2xs text-ink-muted">
          <Loader2 size={13} className="animate-spin text-terracotta-deep" /> دارم درک می‌کنم چه چیزی می‌خواهی عوض کنی…
        </div>
      );
    }
    return null;
  }

  const isFull = analysis.intent === "full_redesign";
  const confidencePct = Math.round(analysis.confidence * 100);
  const lowConfidence = analysis.confidence < 0.6 || analysis.ambiguous;

  return (
    <div className={cn(
      "rounded-xl border p-3.5 transition animate-[fadeUp_0.35s_ease]",
      lowConfidence ? "border-gold/40 bg-gold/5" : "border-sage/30 bg-sage/8",
    )}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-2xs font-bold text-ink">
          <BrainCircuit size={14} className={lowConfidence ? "text-gold" : "text-sage-deep"} />
          AI این‌طور درک کرد:
          <span className={cn("rounded-full px-2 py-0.5 text-2xs font-bold", isFull ? "bg-terracotta/15 text-terracotta-deep" : "bg-sage/15 text-sage-deep")}>
            {INTENT_LABELS[analysis.intent]}
          </span>
          {understanding && <Loader2 size={11} className="animate-spin text-ink-muted" />}
        </div>
        <div className="flex items-center gap-1.5" title="میزان اطمینان AI از درک درخواست">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-clay/40">
            <span className={cn("block h-full rounded-full", confidencePct >= 60 ? "bg-sage-deep" : "bg-gold")} style={{ width: `${confidencePct}%` }} />
          </span>
          <span className="text-2xs font-bold tabular-nums text-ink-muted">٪{toFa(confidencePct)}</span>
        </div>
      </div>

      {/* targets — editable */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-2xs font-bold text-ink-muted">تغییر می‌کند:</span>
        {isFull ? (
          <span className="rounded-md bg-terracotta/15 px-2 py-0.5 text-2xs font-bold text-terracotta-deep">کل فضا (با اجازه‌ی تو)</span>
        ) : analysis.target.length === 0 ? (
          <span className="text-2xs text-ink-muted">هنوز چیزی مشخص نشده</span>
        ) : (
          <>
            {analysis.target.map((el) => (
              <button
                key={el}
                onClick={() => onToggleTarget?.(el)}
                className="group flex items-center gap-1 rounded-md border border-terracotta/40 bg-terracotta/10 px-2 py-0.5 text-2xs font-bold text-terracotta-deep transition hover:bg-terracotta/20"
                title="برای حذف از لیست تغییر، کلیک کن"
              >
                {ELEMENT_LABELS[el]} <span className="text-[8px] text-terracotta-deep/60 group-hover:text-danger">×</span>
              </button>
            ))}
            {onToggleTarget && (
              <span className="text-2xs text-ink-muted">برای حذف، روی مورد کلیک کن</span>
            )}
          </>
        )}
      </div>

      {/* preserved */}
      {!isFull && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-2xs font-bold text-ink-muted">حفظ می‌شود:</span>
          {analysis.preservedElements.slice(0, 7).map((el) => (
            <span key={el} className="flex items-center gap-0.5 rounded-md bg-ivory-2 px-1.5 py-0.5 text-2xs text-ink-muted">
              <Lock size={8} /> {ELEMENT_LABELS[el]}
            </span>
          ))}
          {analysis.preservedElements.length > 7 && (
            <span className="text-2xs text-ink-muted">و {toFa(analysis.preservedElements.length - 7)} مورد دیگر</span>
          )}
        </div>
      )}

      {/* colors + changes */}
      {(analysis.colors?.length ?? 0) > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-2xs font-bold text-ink-muted">رنگ‌ها:</span>
          {analysis.colors!.map((c) => (
            <span key={c} className="rounded-md bg-ivory-2 px-1.5 py-0.5 text-2xs text-ink-muted">{c}</span>
          ))}
        </div>
      )}

      {analysis.changes.length > 0 && (
        <p className="mt-1.5 text-2xs leading-5 text-ink-muted">«{analysis.changes.join("؛ ")}»</p>
      )}

      {lowConfidence && (
        <p className="mt-2 flex items-start gap-1 text-2xs leading-5 text-gold">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          {analysis.note ?? "درخواست دقیق نیست — مثلاً بنویس: «مبل را عوض کن» یا «رنگ دیوار را کرم کن»."}
        </p>
      )}
      {!lowConfidence && analysis.note && (
        <p className="mt-1.5 text-2xs leading-5 text-ink-muted">{analysis.note}</p>
      )}
    </div>
  );
}

/** Element picker used by the designer for "what should change". */
export function TargetPicker({ value, onChange, disabled }: { value: RoomElement[]; onChange: (els: RoomElement[]) => void; disabled?: boolean }) {
  const toggle = (el: RoomElement) => onChange(value.includes(el) ? value.filter((x) => x !== el) : [...value, el]);
  return (
    <div className="flex flex-wrap gap-1">
      {ALL_ELEMENTS.map((el) => {
        const on = value.includes(el);
        return (
          <button
            key={el}
            type="button"
            disabled={disabled}
            onClick={() => toggle(el)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-2xs font-bold transition disabled:opacity-40",
              on ? "border-terracotta bg-terracotta text-white" : "border-clay/50 bg-ivory-2 text-ink-muted hover:border-terracotta/50 hover:text-ink",
            )}
          >
            <Wand2 size={10} /> {ELEMENT_LABELS[el]}
          </button>
        );
      })}
    </div>
  );
}
