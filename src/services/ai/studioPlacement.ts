// ============================================================
// HOMEINO STUDIO — PRODUCT REPLACEMENT ENGINE (pure logic)
//
// Owner rule: when the customer selects a product, THAT product
// replaces its counterpart in the photo — the original sofa is
// taken out and the selected sofa sits in its place, with REAL
// size analysis so it fits without distortion. Luminaires also
// project their own light (warm glow) according to the product
// description, together with their shape.
//
// Everything here is deterministic and DOM-free so it runs in
// Node tests, the server pipeline and the browser alike.
// ============================================================

export interface StudioProductInput {
  id: string;
  name?: string;
  category?: string;
  /** Real dimensions in cm when known (parsed from the product card). */
  dimensions?: { width?: number; height?: number; depth?: number };
  /** Product description — luminaires may state watt/lumen brightness. */
  description?: string;
}

export type StudioAnchor = "floor" | "ceiling" | "wall" | "ground";

/** Normalized (0..1) target rectangle in image space. */
export interface StudioRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioPlacementPlan {
  productId: string;
  /** Region the product will visually occupy (center = x + width/2 …). */
  targetRegion: StudioRegion;
  /** Share of the image width the product should occupy (0..1). */
  widthPct: number;
  /** Share of the image height the product should occupy (0..1). */
  heightPct: number;
  anchor: StudioAnchor;
  rotation: number;
  /** Persian design rationale — why this spot. */
  rationale: string;
  /** Persian size analysis — what was measured/assumed. */
  sizeReport: string;
  /** Perspective squash for ground-plane items (rug) — used by the compositor. */
  squash?: number;
  /** Light projection for luminaires (chandelier, lamp, sconce…). */
  glow?: { color: string; radiusPct: number; intensity: number; warmth: string };
}

/* ---------------- Scene + furniture reference sizes (cm) ---------------- */

const SCENE_WIDTH_CM: Record<string, number> = {
  living: 420, bedroom: 380, dining: 400, kitchen: 360,
  office: 420, kids: 340, outdoor: 520, default: 420,
};

interface CategoryFit {
  /** Typical real-world width in cm (fallback when the product has none). */
  w: number;
  /** Typical real-world height/length in cm. */
  h: number;
  anchor: StudioAnchor;
  /** Center of the region in normalized image space. */
  cx: number;
  cy: number;
  /** Vertical squash for ground-plane items seen in perspective (rug…). */
  squash?: number;
  rationale: string;
}

const CATEGORY_FIT: Record<string, CategoryFit> = {
  sofa:          { w: 220, h: 85,  anchor: "floor",   cx: 0.46, cy: 0.68, rationale: "کاناپه کانون نشیمن است — دقیقاً جای مبل عکس می‌نشیند" },
  furniture:     { w: 200, h: 85,  anchor: "floor",   cx: 0.46, cy: 0.68, rationale: "مبلمان در ناحیه نشیمن، هم‌اندازه نمونه قبلی" },
  bed:           { w: 180, h: 110, anchor: "floor",   cx: 0.46, cy: 0.66, rationale: "تخت کانون اتاق خواب — جای تخت قبلی" },
  bedding:       { w: 180, h: 110, anchor: "floor",   cx: 0.46, cy: 0.66, rationale: "تخت کانون اتاق خواب — جای تخت قبلی" },
  dining:        { w: 170, h: 78,  anchor: "floor",   cx: 0.48, cy: 0.62, rationale: "میز ناهارخوری در مرکز فضا" },
  table:         { w: 110, h: 55,  anchor: "floor",   cx: 0.5,  cy: 0.66, rationale: "میز جلوی مبلی، هم‌مقیاس عکس" },
  chair:         { w: 85,  h: 90,  anchor: "floor",   cx: 0.64, cy: 0.66, rationale: "صندلی کنار ناحیه نشیمن" },
  carpet:        { w: 250, h: 200, anchor: "ground",  cx: 0.46, cy: 0.78, squash: 0.5, rationale: "فرش روی کف — جای فرش قبلی، با پرسپکتیو کف" },
  rug:           { w: 250, h: 200, anchor: "ground",  cx: 0.46, cy: 0.78, squash: 0.5, rationale: "فرش روی کف — جای فرش قبلی، با پرسپکتیو کف" },
  curtain:       { w: 300, h: 240, anchor: "wall",    cx: 0.5,  cy: 0.32, rationale: "پرده تمام‌قد پنجره، از سقف تا کف" },
  textiles:      { w: 300, h: 240, anchor: "wall",    cx: 0.5,  cy: 0.32, rationale: "پرده تمام‌قد پنجره" },
  lighting:      { w: 70,  h: 60,  anchor: "ceiling", cx: 0.5,  cy: 0.16, rationale: "لوستر سقفی — جای لوستر عکس، با نورپخش گرم" },
  lamp:          { w: 45,  h: 150, anchor: "floor",   cx: 0.14, cy: 0.55, rationale: "آباژور ایستاده در گوشه فضا، با هاله نور" },
  tv:            { w: 130, h: 75,  anchor: "wall",    cx: 0.5,  cy: 0.3,  rationale: "تلویزیون روی دیوار روبروی نشیمن" },
  "tv-console":  { w: 160, h: 50,  anchor: "floor",   cx: 0.5,  cy: 0.62, rationale: "کنسول تلویزیون زیر پنجره/دیوار" },
  art:           { w: 90,  h: 65,  anchor: "wall",    cx: 0.55, cy: 0.28, rationale: "تابلو روی دیوار در ارتفاع دید" },
  decor:         { w: 60,  h: 45,  anchor: "wall",    cx: 0.55, cy: 0.28, rationale: "دکور دیواری در ناحیه دید" },
  plants:        { w: 65,  h: 130, anchor: "floor",   cx: 0.85, cy: 0.55, rationale: "گیاه بلند در گوشه فضا" },
  plant:         { w: 65,  h: 130, anchor: "floor",   cx: 0.85, cy: 0.55, rationale: "گیاه بلند در گوشه فضا" },
  shelf:         { w: 95,  h: 35,  anchor: "wall",    cx: 0.22, cy: 0.24, rationale: "قفسه روی دیوار" },
  bookcase:      { w: 95,  h: 180, anchor: "floor",   cx: 0.14, cy: 0.5,  rationale: "کتابخانه ایستاده کنار دیوار" },
  accessories:   { w: 35,  h: 40,  anchor: "floor",   cx: 0.72, cy: 0.64, rationale: "اکسسوری روی ناحیه اصلی" },
  office:        { w: 150, h: 76,  anchor: "floor",   cx: 0.42, cy: 0.62, rationale: "میز کار در ناحیه کاری" },
  outdoor:       { w: 160, h: 80,  anchor: "floor",   cx: 0.48, cy: 0.64, rationale: "ناحیه مرکزی فضای باز" },
  furniture_default: { w: 120, h: 80, anchor: "floor", cx: 0.46, cy: 0.64, rationale: "ناحیه اصلی فضا — هم‌مقیاس با عکس" },
};

const GLOW_COLOR = "#FFD9A3";
const GLOW_WARMTH = "گرم";

function normalizeCat(category?: string): string {
  const c = (category ?? "").trim().toLowerCase().replace(/[_-]+/g, "-");
  if (CATEGORY_FIT[c]) return c;
  const key = Object.keys(CATEGORY_FIT).find((k) => c.includes(k) || k.includes(c));
  return key ?? "furniture_default";
}

/** Refine a lighting product's fixture type from its Persian name. */
function lightingFitOf(name: string): CategoryFit {
  const n = name.toLowerCase();
  if (n.includes("لوستر") || n.includes("چراغ سقفی") || n.includes("آویز")) {
    return { ...CATEGORY_FIT.lighting, rationale: "لوستر سقفی — دقیقاً جای لوستر عکس می‌نشیند و روشنایی محصول را با شکل خودش نشان می‌دهد" };
  }
  if (n.includes("ایستاده")) return { ...CATEGORY_FIT.lamp, rationale: "آباژور ایستاده در گوشه فضا — نور گرم مطابق توضیحات محصول" };
  if (n.includes("رومیزی")) return { ...CATEGORY_FIT.lamp, w: 32, h: 48, cy: 0.6, cx: 0.68, rationale: "آباژور رومیزی کنار مبل — هاله نور ملایم" };
  if (n.includes("دیوارکوب") || n.includes("وال")) {
    return { w: 22, h: 32, anchor: "wall", cx: 0.24, cy: 0.4, rationale: "دیوارکوب روی دیوار — نور جهت‌دار" };
  }
  return CATEGORY_FIT.lighting;
}

/** Refine generic furniture from its Persian name (مبل/کاناپه/میز/صندلی…). */
function furnitureFitOf(name: string): CategoryFit {
  const n = name.toLowerCase();
  // Order matters: «میز جلومبلی» contains «مبل» as a substring.
  if (n.includes("ناهارخوری")) return CATEGORY_FIT.dining;
  if (n.includes("میز")) return CATEGORY_FIT.table;
  if (n.includes("مبل") || n.includes("کاناپه") || n.includes("شیزو") || n.includes("نیمکت")) {
    return { ...CATEGORY_FIT.sofa, rationale: "مبل کانون نشیمن است — مبلی که در عکس هست برداشته می‌شود و مبلی که انتخاب کردی دقیقاً جای آن می‌نشیند" };
  }
  if (n.includes("صندلی")) return CATEGORY_FIT.chair;
  if (n.includes("پاف")) return { w: 60, h: 45, anchor: "floor", cx: 0.64, cy: 0.72, rationale: "پاف کنار ناحیه نشیمن" };
  return CATEGORY_FIT.furniture;
}

/** Extract brightness hints from the description (watt / lumen / light tone). */
function brightnessOf(description?: string): { intensity: number; note?: string; color: string; warmth: string } {
  const warm: boolean = true;
  if (!description) return { intensity: 0.5, color: GLOW_COLOR, warmth: GLOW_WARMTH };
  const d = description.replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x)));
  const watt = /(\d{1,4})\s*(وات|w(?:att)?\b)/i.exec(d);
  const lumen = /(\d{2,6})\s*(لومن|lm\b)/i.exec(d);
  let intensity = 0.5;
  let note: string | undefined;
  if (watt) {
    const w = Number(watt[1]);
    intensity = Math.min(0.8, Math.max(0.35, 0.35 + w / 130));
    note = `${watt[1]} وات`;
  }
  if (lumen) {
    const l = Number(lumen[1]);
    intensity = Math.min(0.85, Math.max(intensity, 0.35 + l / 3000));
    note = note ? `${note} · ${lumen[1]} لومن` : `${lumen[1]} لومن`;
  }
  const cool = d.includes("سرد") || d.includes("آفتابی") || /cool|daylight/i.test(d);
  const warmLight = d.includes("گرم") || /warm/i.test(d);
  if (cool) return { intensity, note, color: "#EAF2FF", warmth: "سرد" };
  if (warmLight || warm) return { intensity, note, color: GLOW_COLOR, warmth: GLOW_WARMTH };
  return { intensity, note, color: GLOW_COLOR, warmth: GLOW_WARMTH };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------------- Size analysis ---------------- */

export interface PlacementSizeAnalysis {
  widthCm: number;
  heightCm: number;
  widthPct: number;
  heightPct: number;
  usedRealDimensions: boolean;
}

/**
 * Real size analysis: product cm vs the visible scene width →
 * normalized share of the image. Falls back to category-typical
 * dimensions when the product card has no measurements.
 */
export function analyzePlacementSize(
  product: StudioProductInput,
  fit: CategoryFit,
  roomType?: string,
): PlacementSizeAnalysis {
  const scene = SCENE_WIDTH_CM[roomType ?? "default"] ?? SCENE_WIDTH_CM.default;
  const usedRealDimensions = Boolean(product.dimensions?.width && product.dimensions.height);
  const w = usedRealDimensions ? (product.dimensions?.width ?? fit.w) : fit.w;
  const h = usedRealDimensions ? (product.dimensions?.height ?? fit.h) : fit.h;
  const widthPct = clamp(w / scene, 0.05, 0.92);
  // Height derives from the real w:h ratio; ground items are squashed by perspective.
  const rawHeightPct = widthPct * (h / w) * (fit.squash ?? 1);
  const heightPct = clamp(rawHeightPct, 0.04, 0.95);
  return {
    widthCm: Math.round(w),
    heightCm: Math.round(h),
    widthPct,
    heightPct,
    usedRealDimensions,
  };
}

function sizeReportFa(name: string | undefined, a: PlacementSizeAnalysis, fit: CategoryFit, glowNote?: string): string {
  const label = name ? `«${name}»` : "محصول";
  const src = a.usedRealDimensions ? "با ابعاد واقعی کارت محصول" : "با ابعاد مرجع این دسته";
  const base = `${label} ${src} (${a.widthCm}×${a.heightCm} سانتی‌متر) آنالیز و به مقیاس عکس تنظیم شد — بدون تغییر اندازه.`;
  const anchorFa = fit.anchor === "ceiling" ? " روی سقف نصب می‌شود" : fit.anchor === "wall" ? " روی دیوار/لبه قرار می‌گیرد" : fit.anchor === "ground" ? " روی کف با پرسپکتیو پهن می‌شود" : " روی کف می‌نشیند";
  return glowNote ? `${base} نورپردازی${glowNote ? ` (${glowNote})` : ""} هم مطابق توضیحات محصول همراه شکل آن نمایش داده می‌شود.` : `${base} محصول${anchorFa}.`;
}

/* ---------------- Multi-product replacement planning ---------------- */

function intersects(a: StudioRegion, b: StudioRegion): boolean {
  const m = 0.02;
  return a.x < b.x + b.width + m && a.x + a.width + m > b.x && a.y < b.y + b.height + m && a.y + a.height + m > b.y;
}

/** Deterministic nudge until the region no longer collides with occupied ones. */
function resolveCollision(region: StudioRegion, occupied: StudioRegion[]): StudioRegion {
  let r = { ...region };
  for (let step = 1; step <= 14; step++) {
    if (!occupied.some((o) => intersects(r, o))) break;
    const d = step * 0.05;
    switch (step % 4) {
      case 1: r = { ...r, x: clamp(r.x + d, 0.01, 0.98 - r.width) }; break;
      case 2: r = { ...r, y: clamp(r.y + d * 0.5, 0.01, 0.98 - r.height) }; break;
      case 3: r = { ...r, x: clamp(r.x - d, 0.01, 0.98 - r.width) }; break;
      default: r = { ...r, y: clamp(r.y - d * 0.5, 0.01, 0.98 - r.height) }; break;
    }
  }
  return r;
}

/**
 * Plan the replacement of EVERY selected product: each one takes the
 * spot of its counterpart in the photo, sized from real dimensions.
 * Collision avoidance is LAYER-aware: a rug intentionally layers under
 * the sofa, a chandelier floats above — only same-layer items push
 * each other out. Deterministic — same inputs, same plan.
 */
export function planReplacementPlacements(
  products: StudioProductInput[],
  opts?: { roomType?: string; /** Previously occupied regions (all layers). */ occupied?: StudioRegion[] },
): StudioPlacementPlan[] {
  const initial = opts?.occupied ?? [];
  const byLayer: Record<StudioAnchor, StudioRegion[]> = { floor: [...initial], ground: [...initial], wall: [...initial], ceiling: [...initial] };
  const plans: StudioPlacementPlan[] = [];

  products.forEach((product, index) => {
    const name = product.name ?? "";
    let fit: CategoryFit;
    const cat = normalizeCat(product.category);
    if (cat === "lighting" || cat === "lamp") fit = lightingFitOf(name);
    else if (cat === "furniture" || cat === "furniture_default" || cat === "office") fit = furnitureFitOf(name);
    else fit = CATEGORY_FIT[cat] ?? CATEGORY_FIT.furniture_default;

    const size = analyzePlacementSize(product, fit, opts?.roomType);

    // Region around the anchor center.
    let region: StudioRegion = {
      x: clamp(fit.cx - size.widthPct / 2, 0.01, 0.99 - size.widthPct),
      y: clamp(fit.cy - size.heightPct / 2, 0.01, 0.99 - size.heightPct),
      width: size.widthPct,
      height: size.heightPct,
    };

    const isEmitters = fit.anchor === "ceiling" || product.category === "lighting" || /لوستر|آباژور|چراغ|دیوارکوب/.test(name);
    if (index > 0 || initial.length) region = resolveCollision(region, byLayer[fit.anchor]);

    let glow: StudioPlacementPlan["glow"];
    let glowNote: string | undefined;
    if (isEmitters) {
      const b = brightnessOf(product.description);
      glow = {
        color: b.color,
        radiusPct: clamp(size.widthPct * 2.4, 0.12, 0.6),
        intensity: b.intensity,
        warmth: b.warmth,
      };
      glowNote = b.note ? `نور ${b.note} (${b.warmth})` : `نور ${b.warmth}`;
    }

    byLayer[fit.anchor].push(region);
    plans.push({
      productId: product.id,
      targetRegion: region,
      widthPct: size.widthPct,
      heightPct: size.heightPct,
      anchor: fit.anchor,
      rotation: 0,
      rationale: fit.rationale,
      sizeReport: sizeReportFa(name, size, fit, glowNote),
      squash: fit.squash ?? 1,
      glow,
    });
  });

  return plans;
}
