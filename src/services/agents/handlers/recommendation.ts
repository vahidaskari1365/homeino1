// ============================================================
// HOMEINO — RECOMMENDATION AGENT
//
// Input : CustomerProfile + real catalog (+ optional seed product / room /
//         style / color / budget context)
// Output: ranked REAL products, persisted through the createRecommendation tool
//
// Ranking factors (see recommendations/ranking.ts): style similarity, category
// relevance, color compatibility, price compatibility, room compatibility,
// behaviour similarity, purchase history, recent interest, popularity,
// inventory availability, vendor quality.
//
// The LLM is optional here: it can only re-rank products that already came from
// the catalog, and its answer is validated — it can never add a product.
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";
import type { CustomerProfileSnapshot } from "../types";

interface RecommendationItem {
  id?: string;
  productId?: string;
  slug?: string;
  sku?: string | null;
  name?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
  score?: number;
  rank?: number;
  reasonCode?: string;
  reasonText?: string;
  url?: string;
  images?: string[];
  storeId?: string;
  storeName?: string | null;
}

export const runRecommendationAgent: AgentHandler = async (input, ctx) => {
  const scenario = str(input.scenario) ?? "home";
  const limit = Math.min(Math.max(1, num(input.limit ?? ctx.agent.config?.limit, 12)), 40);
  const seedProductId = str(input.seedProductId) ?? str((input.product as Record<string, unknown> | undefined)?.id) ?? null;

  // 1. Real preferences (recomputed only when the caller asks for it).
  const preferences = await ctx.callTool("getCustomerPreferences", {
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    recompute: input.recompute === true,
  });
  const profile = ((preferences.data as { profile?: CustomerProfileSnapshot | null })?.profile ?? null) as CustomerProfileSnapshot | null;

  // 2. Ask the engine (through the tool) for real, ranked, persisted items.
  const generated = await ctx.callTool("createRecommendation", {
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    scenario,
    limit,
    seedProductId,
  });

  if (!generated.ok) {
    ctx.log("ساخت پیشنهاد ناموفق بود", { error: generated.error });
    return {
      output: { dataState: "no_data", reason: generated.error ?? "generation_failed", items: [], count: 0, scenario },
      dataState: "no_data",
    };
  }

  const data = generated.data as { items?: RecommendationItem[]; persisted?: number; dataState?: string; source?: string };
  let items = (data.items ?? []).slice(0, limit);

  // 3. Optional LLM re-rank — only allowed to reorder existing catalog items.
  if (items.length > 1 && ctx.permissions.includes("CALL_LLM") && input.rerankWithLlm !== false && ctx.agent.config?.rerankWithLlm !== false) {
    items = await maybeRerank(items, profile, ctx, scenario);
  }

  const dataState = items.length ? (data.dataState === "not_enough_data" ? "not_enough_data" : "ok") : profile && profile.dataState === "no_data" ? "no_data" : "not_enough_data";

  ctx.log(`${items.length} پیشنهاد واقعی برای سناریوی ${scenario} ساخته شد`, { persisted: data.persisted ?? 0 });

  return {
    output: {
      dataState,
      scenario,
      count: items.length,
      persisted: data.persisted ?? 0,
      source: data.source ?? "engine",
      profileConfidence: profile?.confidence ?? 0,
      profileDataState: profile?.dataState ?? "no_data",
      items,
      honestNote:
        dataState === "ok"
          ? undefined
          : "داده‌ی رفتاری کافی برای ادعای «سلیقه‌ی دقیق» وجود ندارد؛ پیشنهادها از داده‌ی واقعی موجود ساخته شده‌اند.",
    },
    dataState,
  };
};

async function maybeRerank(
  items: RecommendationItem[],
  profile: CustomerProfileSnapshot | null,
  ctx: Parameters<AgentHandler>[1],
  scenario: string,
): Promise<RecommendationItem[]> {
  const catalog = items.map((item, index) => ({
    ref: index,
    id: item.productId ?? item.id,
    name: item.name,
    price: item.price,
    score: item.score,
    reason: item.reasonCode,
  }));
  const result = await ctx.callTool("llmComplete", {
    json: true,
    maxTokens: 220,
    system:
      "تو یک بازرتبه‌بند پیشنهاد محصول هستی. فقط می‌توانی ترتیب آیتم‌های داده‌شده را عوض کنی. هیچ محصول، قیمت یا شناسه‌ی جدیدی نساز. خروجی فقط JSON باشد.",
    prompt: JSON.stringify({
      task: "rerank",
      scenario,
      profile: profile
        ? {
            styles: profile.preferredStyles,
            colors: profile.preferredColors,
            categories: profile.preferredCategories,
            priceRange: profile.preferredPriceRange,
            confidence: profile.confidence,
          }
        : null,
      candidates: catalog,
    }),
  });

  if (!result.ok) return items;
  const payload = (result.data as { data?: { order?: number[] } })?.data ?? (result.data as { order?: number[] } | null);
  const order = Array.isArray(payload?.order) ? payload!.order : null;
  if (!order?.length) return items;

  const valid = order
    .filter((ref): ref is number => typeof ref === "number" && Number.isInteger(ref) && ref >= 0 && ref < items.length)
    .filter((ref, index, self) => self.indexOf(ref) === index);
  if (valid.length < 2) return items;

  const reranked = [...valid.map((ref) => items[ref]), ...items.filter((_, index) => !valid.includes(index))];
  return reranked.map((item, index) => ({ ...item, rank: index + 1 }));
}
