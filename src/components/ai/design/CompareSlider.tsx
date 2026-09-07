"use client";
// ============================================================
// اسلایدر «قبل / بعد» — الگویی که تقریباً همه رقبا دارند
// (Spacely، Decoratly، RoomGPT) و بهترین «وای» بعد از رندر است.
// RTL-پسند: سمت راست «قبل» (عکس اصلی تو)، با کشیدن دستگیره به چپ
// «بعد» (نتیجه استودیو) آشکار می‌شود. با موس، لمس و کیبورد کار می‌کند.
// ============================================================
import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompareSlider({
  before,
  after,
  className,
}: {
  before: string;
  after: string;
  className?: string;
}) {
  const [pos, setPos] = useState(50); // درصد آشکارشدن «بعد» از سمت چپ
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const pct = ((clientX - r.left) / r.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    update(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) update(e.clientX);
  };
  const stop = () => { dragging.current = false; };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { setPos((p) => Math.min(100, p + 4)); e.preventDefault(); }
    if (e.key === "ArrowRight") { setPos((p) => Math.max(0, p - 4)); e.preventDefault(); }
    if (e.key === "Home") setPos(0);
    if (e.key === "End") setPos(100);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerLeave={stop}
      onKeyDown={onKeyDown}
      role="slider"
      aria-label="مقایسه قبل و بعد از طراحی"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      className={cn(
        "relative w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl border border-clay/40 bg-ink outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60",
        className,
      )}
    >
      {/* بعد — نتیجه استودیو (لایه زیرین، کامل) */}
      <img src={after} alt="نتیجه طراحی هومینو استودیو" className="block w-full" draggable={false} />

      {/* قبل — عکس اصلی تو (لایه رویی، بریده از سمت چپ) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={before} alt="عکس اصلی اتاق شما" className="h-full w-full object-cover" draggable={false} />
      </div>

      {/* خط + دستگیره */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }} aria-hidden>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.45)]" />
        <span className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/90 bg-ink/70 text-cream shadow-lg backdrop-blur transition-transform">
          <ChevronsLeftRight size={18} />
        </span>
      </div>

      {/* برچسب‌ها */}
      <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-md bg-ink/65 px-2.5 py-1 text-xs font-bold text-cream backdrop-blur" aria-hidden>قبل</span>
      <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-terracotta-deep/85 px-2.5 py-1 text-xs font-bold text-cream backdrop-blur" aria-hidden>بعد</span>
    </div>
  );
}
