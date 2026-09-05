"use client";
import { useRef, useState, useCallback } from "react";
import { ShoppingCart, Heart, X, ExternalLink, Move, Maximize2 } from "lucide-react";
import { useOverlayGeometry } from "@/lib/overlayGeometry";
import { toFa, formatPrice, cn } from "@/lib/utils";
import type { Product } from "@/types";

export type OverlayMode = "interactive" | "real_edit";

export interface Placement {
  product: Product;
  xNorm: number;
  yNorm: number;
  scale: number;
  rotation?: number;
  /** Analyzed width as a share of the image width (0..1) — studio replacement. */
  widthPct?: number;
  /** Perspective squash for ground items (rug) — composite only. */
  heightSquash?: number;
  /** Light projection for luminaires — composite only. */
  glow?: { color: string; radiusPct: number; intensity: number; warmth?: string };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

interface Props {
  roomImage: string;
  placements: Placement[];
  /** "interactive" = products placed by user (not AI-generated into image).
   *  "real_edit" = AI actually composited products into the image. */
  mode?: OverlayMode;
  onChange?: (id: string, patch: Partial<Placement>) => void;
  onRemove?: (id: string) => void;
  onWishlist?: (p: Product) => void;
  onCart?: (p: Product) => void;
  onView?: (p: Product) => void;
}

/**
 * Pixel-accurate Interactive Overlay.
 * Uses cover-aware geometry: AI coords (image-space 0-1) are transformed
 * through the actual object-fit:cover visible rectangle, so markers stay
 * locked to the correct spot across mobile/tablet/desktop.
 *
 * Features:
 *  - Drag to move (pointer events, unified mouse/touch)
 *  - Pinch / wheel to resize
 *  - Keyboard accessible (Tab to focus, arrows to move, +/- to scale, Del to remove)
 */
export function ProductOverlay({ roomImage, placements, mode = "interactive", onChange, onRemove, onWishlist, onCart, onView }: Props) {
  const { containerRef, onImageLoad, aspectRatio, toPixel, fromPixel } = useOverlayGeometry();
  const [selected, setSelected] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelected(id);
    dragId.current = id;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const move = useCallback((e: React.PointerEvent) => {
    if (!dragId.current || !containerRef.current || !fromPixel) return;
    const r = containerRef.current.getBoundingClientRect();
    const result = fromPixel(e.clientX - r.left, e.clientY - r.top);
    if (result) onChange?.(dragId.current, result);
  }, [containerRef, fromPixel, onChange]);

  const endDrag = useCallback(() => { dragId.current = null; }, []);

  // Keyboard: arrow keys move, +/- scales, Delete removes
  const onKeyDown = (e: React.KeyboardEvent, pl: Placement) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    let handled = true;
    switch (e.key) {
      case "ArrowRight": onChange?.(pl.product.id, { xNorm: clamp01(pl.xNorm + step) }); break;
      case "ArrowLeft": onChange?.(pl.product.id, { xNorm: clamp01(pl.xNorm - step) }); break;
      case "ArrowDown": onChange?.(pl.product.id, { yNorm: clamp01(pl.yNorm + step) }); break;
      case "ArrowUp": onChange?.(pl.product.id, { yNorm: clamp01(pl.yNorm - step) }); break;
      case "+": case "=": onChange?.(pl.product.id, { scale: Math.min(3, pl.scale + 0.1) }); break;
      case "-": case "_": onChange?.(pl.product.id, { scale: Math.max(0.3, pl.scale - 0.1) }); break;
      case "Delete": case "Backspace": onRemove?.(pl.product.id); setSelected(null); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  };

  // Wheel to resize selected
  const onWheel = (e: React.WheelEvent, pl: Placement) => {
    if (selected !== pl.product.id) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    onChange?.(pl.product.id, { scale: clamp01Scale(pl.scale + delta) });
  };

  return (
    <div className="relative w-full select-none overflow-hidden rounded-2xl border border-clay/40 bg-ink">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl"
        style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : { aspectRatio: "16/10" }}
        onPointerMove={move}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <img src={roomImage} alt="اتاق شما" className="h-full w-full object-cover" draggable={false} onLoad={onImageLoad} />

        {placements.map((pl) => {
          const p = pl.product;
          if (!p?.images?.[0]) return null;
          const isSel = selected === p.id;
          const pixel = toPixel?.(pl.xNorm, pl.yNorm);
          const posStyle = pixel
            ? { left: `${pixel.left}px`, top: `${pixel.top}px` }
            : { left: `${pl.xNorm * 100}%`, top: `${pl.yNorm * 100}%` };

          return (
            <div
              key={p.id}
              tabIndex={0}
              role="button"
              aria-label={`${p.name} — کلیدهای جهت‌نما برای حرکت، + و - برای اندازه`}
              className={cn("absolute cursor-grab touch-none outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-gold active:cursor-grabbing", isSel && "z-30")}
              style={{ ...posStyle, width: `${Math.round(clamp01Width(pl.widthPct ?? 0.15) * 100)}%`, zIndex: isSel ? 30 : 10, transform: `translate(-50%, -50%) scale(${pl.scale}) rotate(${pl.rotation || 0}deg)` }}
              onPointerDown={(e) => startDrag(e, p.id)}
              onWheel={(e) => onWheel(e, pl)}
              onKeyDown={(e) => onKeyDown(e, pl)}
              onClick={(e) => { e.stopPropagation(); setSelected(p.id); }}
            >
              <img src={p.images[0]} alt={p.name} className={cn("h-auto w-full rounded-lg object-contain drop-shadow-2xl", isSel && "ring-2 ring-gold")} draggable={false} />

              {/* resize handle */}
              {isSel && (
                <div
                  className="absolute -bottom-2 -left-2 grid h-6 w-6 cursor-nwse-resize place-items-center rounded-full border border-cream/40 bg-ink/90 text-cream"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startScale = pl.scale;
                    const onMove = (ev: PointerEvent) => {
                      const delta = (ev.clientX - startX) / 200;
                      onChange?.(p.id, { scale: clamp01Scale(startScale + delta) });
                    };
                    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }}
                >
                  <Maximize2 size={11} />
                </div>
              )}

              {/* action toolbar */}
              {isSel && (
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-xl border border-clay/30 bg-ink/90 p-1 shadow-2xl backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
                  <button onClick={() => onCart?.(p)} aria-label="افزودن به سبد خرید" className="grid h-9 w-9 place-items-center rounded-lg text-emerald-400 transition hover:bg-white/10 active:scale-90" title="افزودن به سبد"><ShoppingCart size={15} /></button>
                  <button onClick={() => onWishlist?.(p)} aria-label="افزودن به علاقه‌مندی" className="grid h-9 w-9 place-items-center rounded-lg text-rose-400 transition hover:bg-white/10 active:scale-90" title="علاقه‌مندی"><Heart size={15} /></button>
                  <button onClick={() => onView?.(p)} aria-label="مشاهده صفحه محصول" className="grid h-9 w-9 place-items-center rounded-lg text-sky-400 transition hover:bg-white/10 active:scale-90" title="صفحه محصول"><ExternalLink size={15} /></button>
                  <button onClick={() => { onRemove?.(p.id); setSelected(null); }} aria-label="حذف محصول از چیدمان" className="grid h-9 w-9 place-items-center rounded-lg text-red-400 transition hover:bg-white/10 active:scale-90" title="حذف"><X size={15} /></button>
                </div>
              )}

              {/* selected label */}
              {isSel && (
                <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/85 px-2 py-0.5 text-[10px] text-cream">
                  {p.name} · {toFa(formatPrice(p.price))} ت
                </div>
              )}
            </div>
          );
        })}

        {placements.length > 0 && (
          <>
            {/* HONEST MODE BADGE */}
            {mode === "interactive" && (
              <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-gold/20 px-2 py-1 text-[9px] font-medium text-gold-soft backdrop-blur">
                پیش‌نمایش چیدمان — عکس اصلی حفظ شده
              </div>
            )}
            <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-ink/60 px-2 py-1 text-[10px] text-cream backdrop-blur">
              <Move size={11} className="ml-1 inline" /> بکش تا جابه‌جا شود · کلیک کن برای عملیات
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function clamp01Scale(v: number): number {
  return Math.min(3, Math.max(0.3, Number.isFinite(v) ? v : 1));
}

function clamp01Width(v: number): number {
  return Math.min(0.95, Math.max(0.05, Number.isFinite(v) ? v : 0.15));
}
