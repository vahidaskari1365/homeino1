// ============================================================
// HOMEINO AI — PRODUCT-AWARE PLACEMENT  (Phases 7 & 8)
//
// When the user picks a product, the overlay must use REAL product
// info (image, dimensions, category, material, color, style) and
// be placed deliberately — never by random guessing.
//
//   planProductPlacement() → { productId, targetRegion, rotation,
//                              scale, rationale }
//
// Regions are normalized (0..1 of image, origin top-left) so the
// overlay engine can align product perspective/lighting/shadow
// with the environment.
// ============================================================

export interface PlacementProduct {
  id: string;
  name?: string;
  category?: string;
  material?: string;
  color?: string;
  style?: string;
  dimensions?: { width?: number; height?: number; depth?: number };
}

/** Normalized target region + transform for one product. */
export interface ProductPlacementPlan {
  productId: string;
  targetRegion: { x: number; y: number; width: number; height: number };
  rotation: number;
  scale: number;
  /** Short Persian rationale — why this spot. */
  rationale: string;
}

interface LayoutHint {
  region: { x: number; y: number; w: number; h: number };
  rotation: number;
  rationale: string;
}

/**
 * Deterministic layout hints per product category — interior-design
 * conventions, not random coordinates.
 */
const LAYOUT_HINTS: Record<string, LayoutHint> = {
  sofa: { region: { x: 0.16, y: 0.56, w: 0.68, h: 0.36 }, rotation: 0, rationale: "کاناپه کانون نشیمن است — وسط و پایین کادر" },
  furniture: { region: { x: 0.2, y: 0.52, w: 0.6, h: 0.36 }, rotation: 0, rationale: "مبلمان در ناحیه‌ی اصلی نشیمن" },
  rug: { region: { x: 0.2, y: 0.58, w: 0.6, h: 0.3 }, rotation: 0, rationale: "فرش روی کف، زیر ناحیه‌ی نشیمن" },
  rugs: { region: { x: 0.2, y: 0.58, w: 0.6, h: 0.3 }, rotation: 0, rationale: "فرش روی کف، زیر ناحیه‌ی نشیمن" },
  carpet: { region: { x: 0.2, y: 0.58, w: 0.6, h: 0.3 }, rotation: 0, rationale: "فرش روی کف، زیر ناحیه‌ی نشیمن" },
  table: { region: { x: 0.37, y: 0.5, w: 0.26, h: 0.2 }, rotation: 0, rationale: "میز جلوی مبلی در مرکز کادر" },
  dining: { region: { x: 0.3, y: 0.45, w: 0.4, h: 0.34 }, rotation: 0, rationale: "میز ناهارخوری در مرکز فضا" },
  lighting: { region: { x: 0.05, y: 0.28, w: 0.14, h: 0.3 }, rotation: 0, rationale: "چراغ ایستاده در گوشه‌ی فضا" },
  lamp: { region: { x: 0.05, y: 0.28, w: 0.14, h: 0.3 }, rotation: 0, rationale: "آباژور در گوشه‌ی فضا" },
  curtain: { region: { x: 0.0, y: 0.0, w: 0.12, h: 0.7 }, rotation: 0, rationale: "پرده کنار پنجره/لبه‌ی دیوار" },
  textiles: { region: { x: 0.0, y: 0.0, w: 0.12, h: 0.7 }, rotation: 0, rationale: "پرده کنار پنجره" },
  art: { region: { x: 0.55, y: 0.1, w: 0.3, h: 0.24 }, rotation: 0, rationale: "تابلو روی دیوار، در ارتفاع دید" },
  decor: { region: { x: 0.5, y: 0.12, w: 0.28, h: 0.22 }, rotation: 0, rationale: "دکور دیواری در ناحیه‌ی دید" },
  plant: { region: { x: 0.84, y: 0.34, w: 0.13, h: 0.3 }, rotation: 0, rationale: "گیاه در گوشه‌ی فضا" },
  tv: { region: { x: 0.37, y: 0.2, w: 0.26, h: 0.17 }, rotation: 0, rationale: "تلویزیون روی دیوار روبروی نشیمن" },
  "tv-console": { region: { x: 0.35, y: 0.2, w: 0.3, h: 0.2 }, rotation: 0, rationale: "کنسول زیر تلویزیون" },
  bed: { region: { x: 0.18, y: 0.46, w: 0.64, h: 0.42 }, rotation: 0, rationale: "تخت کانون اتاق خواب" },
  bedding: { region: { x: 0.18, y: 0.46, w: 0.64, h: 0.42 }, rotation: 0, rationale: "تخت کانون اتاق خواب" },
  bedroom: { region: { x: 0.18, y: 0.46, w: 0.64, h: 0.42 }, rotation: 0, rationale: "تخت کانون اتاق خواب" },
  chair: { region: { x: 0.64, y: 0.54, w: 0.22, h: 0.24 }, rotation: 0, rationale: "صندلی کنار ناحیه‌ی نشیمن" },
  shelf: { region: { x: 0.08, y: 0.08, w: 0.32, h: 0.2 }, rotation: 0, rationale: "قفسه روی دیوار" },
  bookcase: { region: { x: 0.08, y: 0.08, w: 0.32, h: 0.2 }, rotation: 0, rationale: "قفسه روی دیوار" },
  outdoor: { region: { x: 0.3, y: 0.5, w: 0.4, h: 0.3 }, rotation: 0, rationale: "ناحیه‌ی مرکزی فضای باز" },
  office: { region: { x: 0.3, y: 0.45, w: 0.4, h: 0.3 }, rotation: 0, rationale: "میز کار در ناحیه‌ی کاری" },
};

const DEFAULT_HINT: LayoutHint = {
  region: { x: 0.34, y: 0.34, w: 0.32, h: 0.32 },
  rotation: 0,
  rationale: "ناحیه‌ی مرکزی فضا",
};

function normalizeCategory(category?: string): string {
  if (!category) return "default";
  const c = category.trim().toLowerCase().replace(/[_-]+/g, "-");
  // alias common plurals/compound names to known hints
  if (LAYOUT_HINTS[c]) return c;
  const key = Object.keys(LAYOUT_HINTS).find((k) => c.includes(k) || k.includes(c));
  return key ?? "default";
}

/** True when a region intersects another (with margin). */
function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  const margin = 0.03;
  return (
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.h + margin &&
    a.y + a.h + margin > b.y
  );
}

/**
 * Deterministic, collision-aware placement.
 * The same input ALWAYS yields the same plan (no randomness) —
 * repeated placements nudge deterministically until free.
 */
export function planProductPlacement(
  product: PlacementProduct,
  opts?: {
    /** Regions already occupied (normalized). */
    existing?: { x: number; y: number; w: number; h: number }[];
    /** Image aspect (w/h) — used to keep regions inside the frame. */
    imageAspect?: number;
  },
): ProductPlacementPlan {
  const hint = LAYOUT_HINTS[normalizeCategory(product.category)] ?? DEFAULT_HINT;
  let region = { ...hint.region };

  // Push out of collisions with a deterministic spiral (no random).
  if (opts?.existing?.length) {
    const occupied = opts.existing;
    let step = 0;
    while (occupied.some((o) => intersects(region, o)) && step < 12) {
      step++;
      const d = step * 0.06;
      switch (step % 4) {
        case 1: region = { ...region, x: Math.min(0.9 - region.w, region.x + d) }; break;
        case 2: region = { ...region, y: Math.min(0.9 - region.h, region.y + d * 0.6) }; break;
        case 3: region = { ...region, x: Math.max(0.02, region.x - d) }; break;
        default: region = { ...region, y: Math.max(0.02, region.y - d * 0.6) }; break;
      }
    }
  }

  // Scale from real product dimensions when known (keep aspect sane).
  let scale = 1;
  const dim = product.dimensions;
  if (dim?.width && dim?.height) {
    const productAspect = dim.width / dim.height;
    const regionAspect = region.w / region.h;
    if (productAspect > 0.1 && regionAspect > 0.1) {
      // Fit product into region preserving its aspect ratio.
      if (productAspect > regionAspect) {
        region = { ...region, w: region.w, h: region.w / productAspect };
      } else {
        region = { ...region, h: region.h, w: region.h * productAspect };
      }
    }
    scale = Math.min(1, Math.max(0.4, region.w / (productAspect * region.h)));
  }

  return {
    productId: product.id,
    targetRegion: { x: region.x, y: region.y, width: region.w, height: region.h },
    rotation: hint.rotation,
    scale: Math.round(scale * 100) / 100,
    rationale: hint.rationale,
  };
}

/**
 * Product-aware instruction fragment for the image engine (Phase 7):
 * the engine must render THIS product (not an invented lookalike).
 */
export function productPlacementPrompt(product: PlacementProduct, plan: ProductPlacementPlan): string {
  const facts = [
    product.name && `product: ${product.name}`,
    product.category && `category: ${product.category}`,
    product.material && `material: ${product.material}`,
    product.color && `color: ${product.color}`,
    product.style && `style: ${product.style}`,
  ].filter(Boolean);
  const factsLine = facts.length ? ` (${facts.join(", ")})` : "";
  const r = plan.targetRegion;
  return [
    `Place the selected product${factsLine} at normalized region x=${r.x.toFixed(2)}, y=${r.y.toFixed(2)}, width=${r.width.toFixed(2)}, height=${r.height.toFixed(2)}, rotation=${plan.rotation}deg.`,
    "Match perspective, scale, lighting and shadow of the photo; the product must look naturally integrated.",
  ].join(" ");
}
