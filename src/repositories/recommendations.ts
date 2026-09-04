// ============================================================
// Recommendations repository — the seam between UI and the agent system.
//
// The UI keeps asking a repository for data (see repositories/README.md);
// this one talks to /api/recommendations, which is served by the
// Recommendation Agent. Every item is a REAL catalog product — when the agent
// has no behavioral evidence it says so (`dataState`) and the caller falls back
// to the curated `aiRecommended` catalog list it already had.
// ============================================================
import { api, apiCall } from "@/lib/apiClient";
import { getSessionId } from "@/lib/tracking";
import { products } from "@/data/products";

export interface RecommendationEntry {
  id: string;
  slug: string;
  name: string;
  brand: string;
  images: string[];
  price?: number;
  currency?: string;
  score?: number;
  rank?: number;
  reasonCode?: string;
  reasonText?: string;
  recommendationId?: string | null;
}

export interface RecommendationFeed {
  items: RecommendationEntry[];
  dataState: "ok" | "not_enough_data" | "no_data" | "degraded";
  scenario: string;
  source: string;
}

interface ApiItem {
  id?: string;
  slug?: string;
  name?: string;
  brand?: string;
  images?: string[];
  price?: number;
  currency?: string;
  score?: number;
  rank?: number;
  reasonCode?: string;
  reasonText?: string;
  recommendationId?: string | null;
}

/** The curated list the UI showed before the agent system existed. */
export function curatedRecommendations(limit = 3): RecommendationEntry[] {
  return products
    .filter((p) => p.aiRecommended)
    .slice(0, limit)
    .map((p) => ({ id: p.id, slug: p.slug, name: p.name, brand: p.brand, images: p.images, price: p.price, currency: p.currency }));
}

function normalize(items: unknown): RecommendationEntry[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw): RecommendationEntry | null => {
      const item = (raw ?? {}) as ApiItem;
      if (!item.id || !item.slug || !item.name) return null;
      return {
        id: String(item.id),
        slug: String(item.slug),
        name: String(item.name),
        brand: String(item.brand ?? ""),
        images: Array.isArray(item.images) ? item.images.filter((src): src is string => typeof src === "string") : [],
        price: typeof item.price === "number" ? item.price : undefined,
        currency: typeof item.currency === "string" ? item.currency : undefined,
        score: typeof item.score === "number" ? item.score : undefined,
        rank: typeof item.rank === "number" ? item.rank : undefined,
        reasonCode: typeof item.reasonCode === "string" ? item.reasonCode : undefined,
        reasonText: typeof item.reasonText === "string" ? item.reasonText : undefined,
        recommendationId: typeof item.recommendationId === "string" ? item.recommendationId : null,
      };
    })
    .filter((entry): entry is RecommendationEntry => entry !== null && entry.images.length > 0);
}

export const recommendationsRepository = {
  /**
   * Agent-backed recommendations for one scenario.
   * Never throws: on any failure it returns the curated fallback so the page
   * keeps rendering exactly as before.
   */
  async forScenario(scenario: string, limit = 3, options: { fresh?: boolean; seedProductId?: string | null } = {}): Promise<RecommendationFeed> {
    const fallback: RecommendationFeed = { items: curatedRecommendations(limit), dataState: "no_data", scenario, source: "curated_fallback" };
    const params = new URLSearchParams({ scenario, limit: String(limit), sessionId: getSessionId() });
    if (options.fresh) params.set("fresh", "true");
    if (options.seedProductId) params.set("seedProductId", options.seedProductId);

    const res = await api.get<{ ok?: boolean; data?: { items?: unknown; dataState?: string; source?: string } }>(`/api/recommendations?${params.toString()}`, {
      timeoutMs: 12_000,
      retries: 1,
    });
    if (!res.ok) return fallback;
    const payload = res.data?.data;
    const items = normalize(payload?.items);
    if (!items.length) return { ...fallback, dataState: (payload?.dataState as RecommendationFeed["dataState"]) ?? "no_data" };
    return {
      items: items.slice(0, limit),
      dataState: (payload?.dataState as RecommendationFeed["dataState"]) ?? "ok",
      scenario,
      source: String(payload?.source ?? "agent"),
    };
  },

  /** Similar real products for one seed product (wishlist / detail scenarios). */
  async similarTo(productId: string, limit = 4): Promise<RecommendationFeed> {
    return recommendationsRepository.forScenario("wishlist", limit, { fresh: true, seedProductId: productId });
  },

  /** Dismiss / convert feedback — feeds memory and the next run. */
  async feedback(entry: { recommendationId?: string | null; productId?: string; action: "dismiss" | "click" | "convert"; scenario?: string }) {
    return apiCall<{ ok?: boolean; data?: { ok: boolean; updated: number; action: string } }>("/api/recommendations", {
      method: "DELETE",
      json: {
        recommendationId: entry.recommendationId ?? undefined,
        productId: entry.productId,
        action: entry.action,
        scenario: entry.scenario ?? "home",
        sessionId: getSessionId(),
      },
      timeoutMs: 10_000,
      retries: 0,
    });
  },
};
