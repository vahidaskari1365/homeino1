// ============================================================
// HOMEINO — DECOR PLAN (SERVER-ONLY)
//
// مالک ۲۰۲۶-۰۹-۲۰: «پیشنهاد دکور هم باید یک قسمت مستقل باشد» —
// یک بخش کامل: عکس خانه → تحلیل واقعی بینایی → پیشنهادهای اجرایی
// که هر کدام به محصولات واقعی سایت گره می‌خورند → آمادهٔ اعمال
// روی عکس خود کاربر.
//
// زنجیرهٔ تحلیل همان analyzeRoomWithFallback است (Gemini → z-ai
// vision رایگان → provider) و تطبیق محصولات روی کاتالوگ زندهٔ
// سایت (DB → فیکسچر دمو) انجام می‌شود — هرگز تصادفی، هرگز جعلی.
// ============================================================
import type { DecorPlanResult, DecorSuggestionPlan, ScanMatch } from "./scanTypes";
import { shrinkForVision } from "./imageShrink";
import { analyzeRoomWithFallback } from "./roomAnalysis";
import { catalogPool, type CatalogProduct } from "../agents/catalog";
import type { GenerateDesignInput } from "./types";

const MAX_SUGGESTIONS = 4;
const PRODUCTS_PER_SUGGESTION = 3;
const MAX_TOP_PRODUCTS = 6;

/** Guided-suggestion category (LLM vocabulary) → REAL catalog categorySlugs,
 *  tried in order. The live catalog vocabulary is: furniture, lighting,
 *  decor, textiles, bedroom, workspace, rugs, outdoor, kitchen. */
const SUGGESTION_CATEGORY_MAP: Record<string, string[]> = {
  rug: ["rugs", "textiles", "decor"],
  carpet: ["rugs", "textiles", "decor"],
  lighting: ["lighting", "decor"],
  lamp: ["lighting", "decor"],
  plant: ["outdoor", "decor"],
  plants: ["outdoor", "decor"],
  sofa: ["furniture"],
  furniture: ["furniture"],
  seating: ["furniture"],
  decor: ["decor", "textiles"],
  accessories: ["decor", "textiles"],
  art: ["decor"],
  curtain: ["textiles", "decor"],
  bedding: ["bedroom", "furniture"],
  bed: ["bedroom", "furniture"],
  table: ["furniture", "kitchen"],
  dining: ["furniture", "kitchen"],
  kitchen: ["kitchen", "furniture"],
  storage: ["furniture", "workspace"],
  tv: ["furniture"],
  office: ["workspace", "furniture"],
};

function toMatch(p: CatalogProduct, score: number, reason: string): ScanMatch {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    price: p.price,
    currency: p.currency || "تومان",
    image: p.images[0] ?? "",
    categorySlug: p.categorySlug ?? "furniture",
    score: Math.max(0, Math.min(100, Math.round(score))),
    reason: reason.slice(0, 120),
    inStock: p.inStock,
  };
}

/** Popularity-first deterministic ordering (real signals, never random). */
function popularity(p: CatalogProduct): number {
  return p.salesCount * 2 + p.rating * 20 + p.reviewsCount;
}

/** Color proximity between the analyzed palette and the product's colors. */
function colorAffinity(p: CatalogProduct, palette: string[]): number {
  if (!palette.length || !p.colorHexes.length) return 0;
  let best = 0;
  for (const hex of p.colorHexes) {
    const h = hex.toLowerCase();
    for (const pal of palette) {
      const ph = pal.toLowerCase().replace(/\s+/g, "");
      if (ph === h) return 12;
      // Same family (approx by shared prefix — cheap but deterministic).
      if (ph.startsWith("#") && h.startsWith("#") && ph.slice(0, 4) === h.slice(0, 4)) best = Math.max(best, 6);
    }
  }
  return best;
}

/** Best real products for one suggestion category. */
function matchCategory(
  pool: CatalogProduct[],
  category: string,
  styleSlug: string | undefined,
  palette: string[],
  used: Set<string>,
): { match: ScanMatch | null; target: string } {
  const cat = category.toLowerCase().trim();
  const targets = SUGGESTION_CATEGORY_MAP[cat] ?? [cat];
  for (const target of targets) {
    let candidates = pool.filter((p) => (p.categorySlug ?? "").toLowerCase() === target && !used.has(p.id));
    if (!candidates.length) continue;
    const top = candidates
      .map((p) => ({
        p,
        s:
          popularity(p) +
          colorAffinity(p, palette) +
          (styleSlug && p.styleSlugs.includes(styleSlug) ? 40 : 0),
      }))
      .sort((a, b) => b.s - a.s)[0];
    return {
      match: toMatch(top.p, Math.min(96, 60 + top.s / 20), `بهترین گزینهٔ کاتالوگ هومینو برای «${target}» در این فضا`),
      target,
    };
  }
  // Style-adjacent fallback within the REAL catalog (honest reason).
  const loose = pool.filter((p) => !used.has(p.id) && (!styleSlug || p.styleSlugs.includes(styleSlug)));
  const fallback = (loose.length ? loose : pool.filter((p) => !used.has(p.id)))
    .map((p) => ({ p, s: popularity(p) + colorAffinity(p, palette) }))
    .sort((a, b) => b.s - a.s)[0];
  if (!fallback) return { match: null, target: cat };
  return { match: toMatch(fallback.p, 62, "نزدیک‌ترین گزینهٔ کاتالوگ به سبک فضای تو"), target: fallback.p.categorySlug ?? cat };
}

export async function buildDecorPlan(input: {
  referenceImage: string;
  style?: string;
}): Promise<DecorPlanResult> {
  const image = await shrinkForVision(input.referenceImage);
  const genInput: GenerateDesignInput = {
    mode: "room-redesign",
    prompt: "تحلیل فضا برای پیشنهاد دکور",
    style: input.style ?? "modern",
    room: "پذیرایی",
    referenceImage: image,
  };
  const { analysis, source } = await analyzeRoomWithFallback(genInput);
  const pool = await catalogPool();

  const styleSlug = input.style || analysis.likelyStyle?.style || analysis.style || undefined;
  const styleKey = styleSlug ? String(styleSlug).toLowerCase().split(/\s+/)[0] : undefined;
  const palette = (analysis.palette ?? []).slice(0, 5);
  const used = new Set<string>();

  // ---- Suggestions: the analysis' guided list, each grounded in real products ----
  const rawSuggestions = (analysis.guidedSuggestions ?? []).slice(0, MAX_SUGGESTIONS);
  const suggestions: DecorSuggestionPlan[] = rawSuggestions.map((sg) => {
    const products: ScanMatch[] = [];
    let categoryLabel = sg.category || "furniture";
    for (let i = 0; i < PRODUCTS_PER_SUGGESTION; i++) {
      const { match, target } = matchCategory(pool, sg.category ?? "furniture", styleKey, palette, used);
      if (!match) break;
      used.add(match.id);
      categoryLabel = target;
      products.push(match);
    }
    return {
      id: sg.id,
      title: sg.title,
      desc: sg.desc,
      impact: sg.impact ?? "medium",
      category: categoryLabel,
      products,
    };
  });

  // ---- Overall top products: category-diverse best of the catalog ----
  const topProducts: ScanMatch[] = [];
  const seen = new Set<string>(used);
  for (const sg of suggestions) for (const p of sg.products) {
    if (topProducts.length < MAX_TOP_PRODUCTS && !seen.has(p.id)) { topProducts.push(p); seen.add(p.id); }
  }
  const broad = [...pool]
    .sort((a, b) => popularity(b) - popularity(a))
    .filter((p) => !seen.has(p.id));
  for (const p of broad) {
    if (topProducts.length >= MAX_TOP_PRODUCTS) break;
    topProducts.push(toMatch(p, 70, "انتخاب هومینو برای این فضا"));
    seen.add(p.id);
  }

  return {
    visionAvailable: source !== "sample" && source !== "mock-text-only",
    roomType: analysis.roomType || "فضای مسکونی",
    style: analysis.likelyStyle?.style || analysis.style || styleSlug || "مدرن",
    palette,
    mood: analysis.mood || "",
    suggestions,
    topProducts,
    notice: suggestions.length
      ? undefined
      : "تحلیل این عکس همین الان به پیشنهاد اجرایی نرسید — عکس روشن‌تری از فضا آپلود کن یا دوباره امتحان کن.",
  };
}
