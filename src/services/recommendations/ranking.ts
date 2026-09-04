// ============================================================
// HOMEINO — RECOMMENDATION RANKING
//
// Multi-factor scoring over REAL catalog products. Every factor is derived
// from data that exists (profile from real events, product attributes from the
// catalog, vendor rating from the store record, semantic similarity from
// embeddings). No factor invents popularity or social proof.
// ============================================================
import type { CustomerProfileSnapshot } from "../agents/types";
import type { CatalogProduct } from "../agents/catalog";
import { cosineSimilarity, localEmbed, normalizeText } from "../agents/llmGateway";

export const RANKING_WEIGHTS = {
  styleSimilarity: 0.2,
  categoryRelevance: 0.17,
  colorCompatibility: 0.11,
  priceCompatibility: 0.13,
  roomCompatibility: 0.09,
  behaviorSimilarity: 0.1,
  purchaseHistory: 0.04,
  recentInterest: 0.05,
  popularity: 0.04,
  inventory: 0.03,
  vendorQuality: 0.04,
} as const;

export type RankingFactor = keyof typeof RANKING_WEIGHTS;

export interface RankingSignals {
  profile?: CustomerProfileSnapshot | null;
  /** Explicit request context (shopping assistant / AI designer). */
  styleSlugs?: string[];
  colors?: string[];
  rooms?: string[];
  materials?: string[];
  categorySlug?: string;
  subCategorySlug?: string;
  budget?: { min?: number; max?: number };
  /** Seed product for "مشابه این محصول". */
  seed?: CatalogProduct | null;
  excludeIds?: string[];
  freeText?: string;
}

export interface RankingContext {
  /** productId → vendor rating (0..5) from the real store record. */
  storeRatings?: Map<string, number>;
  /** productId → cosine similarity (0..1) against a query/profile embedding. */
  semantic?: Map<string, number>;
  /** productId → embedding vector (used when `semantic` is not precomputed). */
  embeddings?: Map<string, number[]>;
  profileEmbedding?: number[];
}

export interface ScoredProduct {
  product: CatalogProduct;
  score: number;
  breakdown: Record<string, number>;
  reasonCode: string;
  reasonText: string;
}

const REASON_TEXT: Record<string, string> = {
  style_match: "منطبق بر سبک‌هایی که دیده‌ای",
  similar_product: "مشابه محصولی که انتخاب کردی",
  color_match: "رنگ‌های نزدیک به سلیقه‌ات",
  category_match: "از دسته‌بندی‌های مورد علاقه‌ات",
  in_budget: "داخل بازه بودجه‌ات",
  room_match: "مناسب فضای مورد نظرت",
  store_match: "از فروشگاهی که قبلاً دیده‌ای",
  search_match: "مطابق جستجوی تو",
};

function overlapScore(values: string[] | undefined, target: string[] | undefined, fuzzy = false): number {
  if (!values?.length || !target?.length) return 0;
  let hits = 0;
  for (const value of values) {
    const v = normalizeText(value);
    if (target.some((t) => (fuzzy ? v.includes(normalizeText(t)) || normalizeText(t).includes(v) : normalizeText(t) === v))) hits += 1;
  }
  return Math.min(1, hits / Math.min(values.length, Math.max(1, target.length)));
}

function priceScore(price: number, budget?: { min?: number; max?: number }, profile?: CustomerProfileSnapshot | null): number {
  const min = budget?.min ?? profile?.preferredPriceRange?.min;
  const max = budget?.max ?? profile?.preferredPriceRange?.max;
  if (!min && !max) return 0.5; // neutral — no evidence about budget
  if (min && price < min) return Math.max(0, 0.35 - (min - price) / Math.max(1, min) * 0.3);
  if (max && price > max) return Math.max(0, 0.35 - (price - max) / Math.max(1, max) * 0.5);
  return 1;
}

function popularityScore(product: CatalogProduct): number {
  // Only real recorded numbers are used; unknown ⇒ neutral-low, never inflated.
  const sales = product.salesCount ?? 0;
  const reviews = product.reviewsCount ?? 0;
  const rating = product.rating ?? 0;
  if (!sales && !reviews) return 0.2;
  const salesPart = Math.min(1, Math.log10(1 + sales) / 2.5);
  const reviewPart = Math.min(1, Math.log10(1 + reviews) / 2);
  const ratingPart = rating > 0 ? Math.min(1, rating / 5) : 0.5;
  return Math.min(1, salesPart * 0.5 + reviewPart * 0.25 + ratingPart * 0.25);
}

function inventoryScore(product: CatalogProduct): number {
  if (!product.inStock) return 0;
  if (product.stockCount <= 0) return 0.25;
  if (product.stockCount <= 3) return 0.6;
  return 1;
}

function vendorScore(product: CatalogProduct, ctx: RankingContext): number {
  const rating = ctx.storeRatings?.get(product.storeId);
  if (rating === undefined) return product.storeId ? 0.5 : 0.2;
  return Math.max(0, Math.min(1, rating / 5));
}

function semanticScore(product: CatalogProduct, signals: RankingSignals, ctx: RankingContext): number {
  const precomputed = ctx.semantic?.get(product.id);
  if (precomputed !== undefined) return precomputed;
  if (!ctx.embeddings) return 0;
  const vector = ctx.embeddings.get(product.id);
  if (!vector) return 0;
  const queryVector =
    ctx.profileEmbedding ??
    localEmbed(
      [signals.freeText ?? "", ...(signals.styleSlugs ?? []), ...(signals.colors ?? []), ...(signals.rooms ?? []), signals.categorySlug ?? "", signals.subCategorySlug ?? ""]
        .filter(Boolean)
        .join(" "),
    );
  if (!queryVector.length) return 0;
  return Math.max(0, cosineSimilarity(vector, queryVector));
}

export function scoreProduct(product: CatalogProduct, signals: RankingSignals, ctx: RankingContext = {}): ScoredProduct {
  const profile = signals.profile ?? null;
  const seed = signals.seed ?? null;

  const styleTargets = [...(signals.styleSlugs ?? []), ...(profile?.preferredStyles ?? []), ...(seed?.styleSlugs ?? [])];
  const colorTargets = [...(signals.colors ?? []), ...(profile?.preferredColors ?? []), ...(seed?.colors ?? [])];
  const roomTargets = [...(signals.rooms ?? []), ...(profile?.preferredRooms ?? []), ...(seed?.rooms ?? [])];
  const materialTargets = [...(signals.materials ?? []), ...(profile?.preferredMaterials ?? []), ...(seed?.materials ?? [])];
  const categoryTargets = [signals.categorySlug, signals.subCategorySlug, seed?.categorySlug, seed?.subCategorySlug, ...(profile?.preferredCategories ?? [])].filter(
    (v): v is string => Boolean(v),
  );
  const storeTargets = [...(profile?.preferredStores ?? []), ...(seed?.storeId ? [seed.storeId] : [])];

  const styleSimilarity = Math.max(overlapScore(product.styleSlugs, styleTargets), semanticScore(product, signals, ctx) * 0.6);
  const categoryRelevance = Math.max(
    overlapScore([product.categorySlug ?? "", product.subCategorySlug ?? ""].filter(Boolean), categoryTargets),
    seed && seed.categorySlug === product.categorySlug ? 1 : 0,
  );
  const colorCompatibility = overlapScore(product.colors, colorTargets, true);
  const priceCompatibility = priceScore(product.price, signals.budget, profile);
  const roomCompatibility = overlapScore(product.rooms, roomTargets) || overlapScore(product.tags, roomTargets, true);
  const behaviorSimilarity = seed
    ? Math.max(
        overlapScore(product.materials, seed.materials),
        overlapScore(product.tags, seed.tags, true),
        seed.subCategorySlug && product.subCategorySlug === seed.subCategorySlug ? 0.9 : 0,
        semanticScore(product, signals, ctx),
      )
    : overlapScore([product.id], (profile?.recentInterests ?? []).map((i) => i.entityId ?? "")) ||
      overlapScore(product.materials, materialTargets, true);
  const purchaseHistory = (profile?.purchasePatterns ?? []).some((p) => p.label === product.categorySlug || p.label === `style:${product.styleSlugs[0]}`) ? 1 : 0;
  const recentInterest = (profile?.recentInterests ?? []).some((i) => i.entityId === product.id) ? 0.5 : 0;
  const popularity = popularityScore(product);
  const inventory = inventoryScore(product);
  const vendorQuality = vendorScore(product, ctx);
  const storeAffinity = overlapScore([product.storeId, product.storeName ?? ""].filter(Boolean), storeTargets) ? 1 : 0;

  const breakdown: Record<string, number> = {
    styleSimilarity: round(styleSimilarity),
    categoryRelevance: round(categoryRelevance),
    colorCompatibility: round(colorCompatibility),
    priceCompatibility: round(priceCompatibility),
    roomCompatibility: round(roomCompatibility),
    behaviorSimilarity: round(behaviorSimilarity),
    purchaseHistory: round(purchaseHistory),
    recentInterest: round(recentInterest),
    popularity: round(popularity),
    inventory: round(inventory),
    vendorQuality: round(vendorQuality),
    storeAffinity: round(storeAffinity),
  };

  let score = 0;
  for (const [factor, weight] of Object.entries(RANKING_WEIGHTS) as [RankingFactor, number][]) {
    score += (breakdown[factor] ?? 0) * weight;
  }
  // Small, transparent bonuses that are not part of the weighted model.
  score += breakdown.storeAffinity * 0.03;
  if (signals.freeText) {
    const hay = normalizeText(`${product.name} ${product.brand} ${product.description ?? ""} ${product.tags.join(" ")}`);
    const tokens = normalizeText(signals.freeText).split(/\s+/).filter((t) => t.length > 2);
    const hit = tokens.filter((t) => hay.includes(t)).length;
    score += tokens.length ? (hit / tokens.length) * 0.15 : 0;
    breakdown.textMatch = round(tokens.length ? hit / tokens.length : 0);
  }
  // Hard gates: never recommend an unavailable product, never the seed itself.
  if (!product.inStock) score *= 0.15;
  if (seed && seed.id === product.id) score = -1;
  if (signals.excludeIds?.includes(product.id)) score = -1;

  const reasonCode = pickReason(breakdown, seed, signals);
  return { product, score: round(score, 4), breakdown, reasonCode, reasonText: REASON_TEXT[reasonCode] ?? "پیشنهاد هوشمند Homeino" };
}

function pickReason(breakdown: Record<string, number>, seed: CatalogProduct | null | undefined, signals: RankingSignals): string {
  if (seed) return "similar_product";
  if (signals.freeText) return "search_match";
  const ordered = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const top = ordered[0]?.[0];
  switch (top) {
    case "styleSimilarity":
      return "style_match";
    case "colorCompatibility":
      return "color_match";
    case "categoryRelevance":
      return "category_match";
    case "priceCompatibility":
      return "in_budget";
    case "roomCompatibility":
      return "room_match";
    case "storeAffinity":
    case "vendorQuality":
      return "store_match";
    default:
      return "style_match";
  }
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

export function rankProducts(products: CatalogProduct[], signals: RankingSignals, ctx: RankingContext = {}): ScoredProduct[] {
  return products
    .map((product) => scoreProduct(product, signals, ctx))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}
