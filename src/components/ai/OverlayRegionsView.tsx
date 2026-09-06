"use client";
// ============================================================
// OVERLAY REGIONS VIEW — renders REAL overlay metadata on top of
// the generated result. Data-driven: boxes come from the image
// engine (Orali). When no regions exist, we say so honestly —
// we never draw fake boxes over the image.
//
// Supports the UI contract:
//   original image + generated result + editable region/overlay metadata
// ============================================================
import { useState } from "react";
import { Scan, Layers } from "lucide-react";
import type { OverlayRegion } from "@/services/ai/orali/types";
import { toFa, cn } from "@/lib/utils";

export function OverlayRegionsView({ image, regions, className }: { image: string; regions: OverlayRegion[]; className?: string }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-clay/40", className)}>
      {/* Rendered result — usually a base64/data URL returned by the AI provider.
          next/image can't optimize data URLs, and the overlay boxes rely on this element's box for alignment. */}
      <img src={image} alt="نتیجه طراحی" className="block aspect-video w-full object-cover" draggable={false} />
      {regions.length > 0 ? (
        regions.map((r) => {
          const active = hovered === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setHovered(r.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(r.id)}
              onBlur={() => setHovered(null)}
              className={cn(
                "absolute cursor-default rounded-lg border-2 transition-all duration-200",
                r.status === "failed" ? "border-danger/80 bg-danger/10" : "border-gold/80 bg-gold/15",
                active ? "shadow-[0_0_0_3px_rgba(190,154,79,0.35)]" : "",
              )}
              style={{
                left: `${r.box.x * 100}%`,
                top: `${r.box.y * 100}%`,
                width: `${r.box.w * 100}%`,
                height: `${r.box.h * 100}%`,
                opacity: active ? 1 : (r.opacity ?? 0.85),
              }}
              aria-label={`ناحیه تغییر: ${r.label}`}
            >
              <span className={cn(
                "absolute -top-0.5 right-1 -translate-y-full whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs font-bold text-ink shadow",
                r.status === "failed" ? "bg-danger text-white" : "bg-gold text-ink",
              )}>
                <Layers size={9} className="ml-0.5 inline" /> {r.label}
              </span>
            </button>
          );
        })
      ) : (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-ink/70 px-2 py-1 text-2xs font-medium text-cream backdrop-blur">
          <Scan size={11} className="text-gold-soft" />
          نواحی تغییر: بدون متادیتای overlay — موتور واقعی Orali متصل نیست
        </div>
      )}
      {regions.length > 0 && (
        <div className="absolute bottom-2 right-2 rounded-lg bg-ink/70 px-2 py-1 text-2xs font-medium text-cream backdrop-blur">
          {toFa(regions.length)} ناحیه تغییر یافت شد — روی هر کادر برو تا برجسته شود
        </div>
      )}
    </div>
  );
}
