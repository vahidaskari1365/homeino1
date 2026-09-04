// ============================================================
// HOMEINO — RECOMMENDATION ENGINE
//
// Usable everywhere (home · product detail · store · cart · wishlist · search ·
// AI Designer · account), but it only returns something when real evidence
// exists. With no behaviour and no explicit context it answers
// `not_enough_data` and the caller keeps its existing content — no invented
// "پرفروش‌ترین" or fake social proof.
//
// Every returned product is a real catalog row; every persisted recommendation
// references a real product id.
// ============================================================
import type { CustomerProfileSnapshot } from "../agents/types";
import type { RecommendationRecord } from "../agents/store/types";
import { getStore } from "../agents/store";
import { findCatalogProduct, type CatalogProduct } from "../agents/catalog";
import { effectiveProfile } from "../memory/preferenceEngine";
import { customerMemory } from "../memory/customerMemory";
import { findSimilarRealProducts, matchRealProducts, storeRatings } from "./productMatching";
import type { RankingSignals, ScoredProduct } from "./ranking";

export type RecommendationScenario =
  | "home"
  | "product_detail"
  | "store"
  | "cart"
  | "wishlist"
  | "search"
  | "account"
  | "ai_designer"
  | string;

export type RecommendationDataState = "ok" | "no_data" | "not_enough_data";

export interface RecommendationItem {
  product: CatalogProduct;
  score: number;
  rank: number;
  reasonCode: string;
  reasonText: string;
  breakdown: Record<string, number>;
  recommendationId?: string;
}

export interface GenerateRecommendationsInput {
  userId?: string | null;
  sessionId?: string | null;
  scenario: RecommendationScenario;
  limit?: number;
  seedProductId?: string | null;
  signals?: Partial<RankingSignals>;
  profile?: CustomerProfileSnapshot | null;
  persist?: boolean;
  agentKey?: string;
  runId?: string | null;
  excludeIds?: string[];
  ttlHours?: number;
}

export interface GenerateRecommendationsResult {
  items: RecommendationItem[];
  dataState: RecommendationDataState;
  persisted: number;
  scenario: string;
  profile: CustomerProfileSnapshot | null;
  /** Where the items came from — surfaced in agent logs. */
  source: "similar_product" | "signals" | "profile" | "none";
}

function toItems(scored: ScoredProduct[]): RecommendationItem[] {
  return scored.map((entry, index) => ({
    product: entry.product,
    score: entry.score,
    rank: index + 1,
    reasonCode: entry.reasonCode,
    reasonText: entry.reasonText,
    breakdown: entry.breakdown,
  }));
}

export async function generateRecommendations(input: GenerateRecommendationsInput): Promise<GenerateRecommendationsResult> {
  const limit = Math.min(Math.max(1, input.limit ?? 12), 40);
  const profile = input.profile ?? (await effectiveProfile({ userId: input.userId ?? null, sessionId: input.sessionId ?? null }));

  const seed = input.seedProductId ? await findCatalogProduct({ id: input.seedProductId, slug: input.seedProductId }) : null;
  const signals: RankingSignals = {
    profile,
    ...(input.signals ?? {}),
    excludeIds: [...(input.excludeIds ?? []), ...(seed ? [seed.id] : [])],
  };

  let scored: ScoredProduct[] = [];
  let source: GenerateRecommendationsResult["source"] = "none";

  if (seed) {
    scored = await findSimilarRealProducts(seed, { limit, profile, signals: { excludeIds: signals.excludeIds } });
    source = "similar_product";
  } else if (hasExplicitContext(signals)) {
    scored = await matchRealProducts(signals, { limit });
    source = "signals";
  } else if (profile && profile.dataState !== "no_data") {
    scored = await matchRealProducts(
      {
        profile,
        styleSlugs: profile.preferredStyles,
        colors: profile.preferredColors,
        rooms: profile.preferredRooms,
        materials: profile.preferredMaterials,
        categorySlug: profile.preferredCategories[0],
        budget: profile.preferredPriceRange,
      },
      { limit },
    );
    source = "profile";
  }

  const items = toItems(scored.slice(0, limit));
  const dataState: RecommendationDataState = items.length
    ? profile && profile.dataState === "ok"
      ? "ok"
      : source === "signals" || source === "similar_product"
        ? "ok"
        : "not_enough_data"
    : profile && profile.dataState === "no_data"
      ? "no_data"
      : "not_enough_data";

  let persisted = 0;
  if (input.persist !== false && items.length && (input.userId || input.sessionId)) {
    const store = await getStore();
    persisted = await store.saveRecommendations({
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      scenario: String(input.scenario ?? "home"),
      agentKey: input.agentKey ?? "recommendation",
      runId: input.runId ?? null,
      replace: true,
      ttlHours: input.ttlHours ?? 24 * 14,
      contextSnapshot: {
        source,
        profileConfidence: profile?.confidence ?? 0,
        profileDataState: profile?.dataState ?? "no_data",
        seedProductId: seed?.id ?? null,
      },
      items: items.map((item) => ({
        productId: item.product.id,
        vendorId: null,
        score: item.score,
        rank: item.rank,
        reasonCode: item.reasonCode,
        reasonText: item.reasonText,
        breakdown: item.breakdown,
      })),
    });
  }

  return { items, dataState, persisted, scenario: String(input.scenario ?? "home"), profile, source };
}

function hasExplicitContext(signals: RankingSignals): boolean {
  return Boolean(
    signals.freeText ||
      signals.categorySlug ||
      signals.subCategorySlug ||
      signals.styleSlugs?.length ||
      signals.colors?.length ||
      signals.rooms?.length ||
      signals.budget?.min ||
      signals.budget?.max,
  );
}

/** Read persisted recommendations and hydrate them with real catalog rows. */
export async function getStoredRecommendations(options: {
  userId?: string | null;
  sessionId?: string | null;
  scenario?: RecommendationScenario;
  limit?: number;
  includeExpired?: boolean;
}): Promise<{ items: RecommendationItem[]; dataState: RecommendationDataState; scenario: string }> {
  const store = await getStore();
  const limit = Math.min(Math.max(1, options.limit ?? 12), 40);
  const records = await store.listRecommendations({
    userId: options.userId ?? undefined,
    sessionId: options.sessionId ?? undefined,
    scenario: options.scenario,
    status: "active",
    limit: limit * 2,
  });

  const items: RecommendationItem[] = [];
  for (const record of records) {
    if (!options.includeExpired && record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) continue;
    const product = await findCatalogProduct({ id: record.productId, slug: record.productId });
    if (!product) continue; // dangling rows are never shown
    if (!product.inStock) continue;
    items.push({
      product,
      score: record.score,
      rank: record.rank,
      reasonCode: record.reasonCode ?? "style_match",
      reasonText: record.reasonText ?? "پیشنهاد هوشمند Homeino",
      breakdown: record.breakdown ?? {},
      recommendationId: record.id,
    });
    if (items.length >= limit) break;
  }

  return {
    items,
    dataState: items.length ? "ok" : "not_enough_data",
    scenario: String(options.scenario ?? "home"),
  };
}

/** Feedback loop: dismiss / convert — both feed memory + the next run. */
export async function recordRecommendationFeedback(options: {
  recommendationId?: string;
  productId?: string;
  userId?: string | null;
  sessionId?: string | null;
  scenario?: string;
  action: "dismiss" | "click" | "convert";
}): Promise<{ ok: boolean; updated: number }> {
  const store = await getStore();
  let updated = 0;

  if (options.recommendationId) {
    const status = options.action === "dismiss" ? "dismissed" : options.action === "convert" ? "converted" : "active";
    if (status !== "active") {
      await store.setRecommendationStatus(options.recommendationId, status);
      updated += 1;
    }
  } else if (options.productId && options.action === "dismiss") {
    const records: RecommendationRecord[] = await store.listRecommendations({
      userId: options.userId ?? undefined,
      sessionId: options.sessionId ?? undefined,
      scenario: options.scenario,
      limit: 100,
    });
    for (const record of records.filter((r) => r.productId === options.productId)) {
      await store.setRecommendationStatus(record.id, "dismissed");
      updated += 1;
    }
  }

  if (options.action === "dismiss" && options.userId && options.productId) {
    const product = await findCatalogProduct({ id: options.productId, slug: options.productId });
    await customerMemory.remember(options.userId, {
      kind: "dismissal",
      key: `product:${options.productId}`,
      text: product ? `مشتری پیشنهاد «${product.name}» را رد کرد` : `مشتری پیشنهاد محصول ${options.productId} را رد کرد`,
      value: { productId: options.productId, name: product?.name ?? null, scenario: options.scenario ?? null },
      importance: 2,
      entityType: "product",
      entityId: options.productId,
      agentKey: "recommendation",
    });
  }

  return { ok: true, updated };
}

/** Convenience for the storefront: ratings map used by the ranking context. */
export { storeRatings };
