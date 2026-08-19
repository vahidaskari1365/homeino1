"use client";
import { useRef, useState, useCallback } from "react";
import { MoveHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Draggable before/after comparison slider.
 * - Unified Pointer Events (mouse + touch)
 * - Keyboard accessible (arrows to move, Home/End)
 * - Pixel-accurate: no layout shift on any breakpoint
 */
export function BeforeAfterSlider({ before, after, className }: { before: string; after: string; className?: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  // Unified pointer events
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    move(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) move(e.clientX);
  };
  const onPointerUp = () => { dragging.current = false; };

  // Keyboard accessibility
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    switch (e.key) {
      case "ArrowLeft": setPos((p) => Math.min(100, p + step)); e.preventDefault(); break;
      case "ArrowRight": setPos((p) => Math.max(0, p - step)); e.preventDefault(); break;
      case "Home": setPos(100); e.preventDefault(); break;
      case "End": setPos(0); e.preventDefault(); break;
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="slider"
      aria-label="مقایسه قبل و بعد"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-gold sm:aspect-[16/10]", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {/* Compare slider — sources are typically base64/data URLs returned by the AI provider;
          next/image can't optimize them, and the clipped overlay needs pixel-locked alignment with the base. */}
      {/* after (base) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="بعد" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      {/* before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="قبل" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      </div>

      {/* labels */}
      <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-0.5 text-[11px] font-medium text-cream backdrop-blur">قبل</span>
      <span className="absolute left-3 top-3 rounded-full bg-terracotta/80 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">بعد</span>

      {/* handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ right: `${pos}%`, transform: "translateX(50%)" }}>
        <div className="absolute inset-y-0 right-1/2 w-0.5 -translate-x-1/2 bg-cream/90 shadow" />
        <div className="absolute top-1/2 right-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-cream bg-ink/80 text-cream shadow-[var(--shadow-lift)] backdrop-blur">
          <MoveHorizontal size={18} />
        </div>
      </div>
    </div>
  );
}
