// ============================================================
// HOMEINO — AI SHOPPING ASSISTANT AGENT
//
// «برای پذیرایی مدرن یک مبل کرم زیر ۵۰ میلیون معرفی کن»
//
//   1. intent understanding (deterministic Persian NLU, optionally refined by
//      the LLM — the LLM may ONLY pick values from the real vocabulary)
//   2. category / style / color / budget / room extraction
//   3. real catalog query through the granted `searchProducts` tool
//   4. multi-factor ranking (recommendations/ranking.ts)
//   5. a Persian answer that references real products only
//
// The LLM is forbidden from producing productId / SKU / price / storeId / URL /
// stock — outputGuard enforces that even if it tries.
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";
import {
  CATEGORY_KEYWORDS,
  COLOR_KEYWORDS,
  ROOM_KEYWORDS,
  STYLE_KEYWORDS,
  SUBCATEGORY_KEYWORDS,
  extractShoppingIntent,
  type ShoppingIntent,
} from "../nlu";
import { rankProducts, type RankingSignals } from "../../recommendations/ranking";
import type { CatalogProduct } from "../catalog";
import type { CustomerProfileSnapshot } from "../types";
import { formatPrice } from "@/lib/utils";

interface SearchHit {
  id: string;
  sku?: string | null;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewsCount: number;
  salesCount?: number;
  styleSlugs: string[];
  colors: string[];
  materials: string[];
  rooms: string[];
  tags?: string[];
  categorySlug?: string | null;
  subCategorySlug?: string | null;
  storeId: string;
  storeName?: string | null;
  images?: string[];
  url: string;
}

function toRankingProduct(hit: SearchHit): CatalogProduct {
  return {
    id: hit.id,
    sku: hit.sku ?? undefined,
    slug: hit.slug,
    name: hit.name,
    brand: hit.brand,
    storeId: hit.storeId,
    storeName: hit.storeName ?? undefined,
    categorySlug: hit.categorySlug ?? undefined,
    subCategorySlug: hit.subCategorySlug ?? undefined,
    styleSlugs: hit.styleSlugs ?? [],
    price: hit.price,
    currency: hit.currency,
    colors: hit.colors ?? [],
    colorHexes: [],
    materials: hit.materials ?? [],
    rooms: hit.rooms ?? [],
    tags: hit.tags ?? [],
    inStock: hit.inStock !== false,
    stockCount: hit.stockCount ?? 0,
    rating: hit.rating ?? 0,
    reviewsCount: hit.reviewsCount ?? 0,
    salesCount: hit.salesCount ?? 0,
    images: hit.images ?? [],
    source: "catalog",
  };
}

export const runShoppingAssistant: AgentHandler = async (input, ctx) => {
  const message = str(input.message) ?? str(input.query) ?? str(input.prompt) ?? "";
  const maxResults = Math.min(Math.max(1, num(input.limit ?? ctx.agent.config?.maxResults, 6)), 20);

  if (!message) {
    return {
      output: { dataState: "no_data", reason: "empty_message", products: [], answer: "چه چیزی برای خانه‌ات لازم داری؟ مثلاً «مبل کرم برای پذیرایی مدرن زیر ۵۰ میلیون»." },
      dataState: "no_data",
    };
  }

  // ---- 1. deterministic understanding ----
  let understanding = extractShoppingIntent(message);

  // ---- 2. optional LLM refinement (vocabulary-constrained) ----
  if (ctx.permissions.includes("CALL_LLM")) {
    understanding = await refineWithLlm(message, understanding, ctx);
  }

  // ---- 2b. SKU supplied by the orchestrator (e.g. PDP-context inquiry) ----
  const forcedSku = str(input.sku);
  if (forcedSku && !understanding.sku) {
    understanding = { ...understanding, sku: forcedSku, isShopping: true };
  }

  // ---- 3. explicit SKU: exact lookup, never a substitute ----
  if (understanding.sku) {
    const resolved = await ctx.callTool("matchProductsBySku", { sku: understanding.sku });
    const data = resolved.data as { status?: string; product?: SearchHit; message?: string } | undefined;
    if (!resolved.ok || data?.status === "not_found" || !data?.product) {
      ctx.log(`SKU پیدا نشد: ${understanding.sku}`);
      return {
        output: {
          dataState: "no_data",
          skuStatus: "not_found",
          sku: understanding.sku,
          products: [],
          understanding: publicUnderstanding(understanding),
          answer: data?.message ?? `کد محصول «${understanding.sku}» در کاتالوگ Homeino پیدا نشد.`,
        },
        dataState: "no_data",
      };
    }
    const product = data.product;
    await rememberRequest(ctx, message, understanding);
    return {
      output: {
        dataState: "ok",
        skuStatus: "found",
        understanding: publicUnderstanding(understanding),
        products: [product],
        count: 1,
        answer: `محصول «${product.name}» با کد ${understanding.sku} پیدا شد — قیمت ${formatPrice(product.price)} ${product.currency}.`,
      },
      dataState: "ok",
    };
  }

  if (!understanding.isShopping) {
    return {
      output: {
        dataState: "no_data",
        reason: "not_a_shopping_request",
        understanding: publicUnderstanding(understanding),
        products: [],
        answer: "این درخواست را به‌عنوان خرید شناسایی نکردم. اگر محصول خاصی می‌خواهی، دسته، سبک، رنگ یا بودجه را بگو تا از کاتالوگ واقعی Homeino پیدا کنم.",
      },
      dataState: "no_data",
    };
  }

  // ---- 4. real catalog query through the granted tool ----
  const search = await ctx.callTool("searchProducts", {
    q: understanding.q.slice(0, 120),
    categorySlug: understanding.categorySlug,
    subCategorySlug: understanding.subCategorySlug,
    styleSlug: understanding.styleSlugs[0],
    colors: understanding.colors,
    materials: understanding.materials,
    rooms: understanding.rooms,
    minPrice: understanding.budget?.min,
    maxPrice: understanding.budget?.max,
    inStockOnly: true,
    limit: 120,
  });

  const hits = ((search.data as { items?: SearchHit[] })?.items ?? []).filter((item) => item && item.id);

  // ---- 5. ranking with the customer's real profile as a secondary signal ----
  const preferences = await ctx.callTool("getCustomerPreferences", { userId: ctx.userId, sessionId: ctx.sessionId });
  const profile = ((preferences.data as { profile?: CustomerProfileSnapshot | null })?.profile ?? null) as CustomerProfileSnapshot | null;

  const signals: RankingSignals = {
    profile,
    freeText: understanding.q,
    categorySlug: understanding.categorySlug,
    subCategorySlug: understanding.subCategorySlug,
    styleSlugs: understanding.styleSlugs,
    colors: understanding.colors,
    rooms: understanding.rooms,
    materials: understanding.materials,
    budget: understanding.budget ?? undefined,
  };

  const ranked = hits.length ? rankProducts(hits.map(toRankingProduct), signals) : [];

  // If the strict search found nothing, widen step by step along the expressed
  // dimensions. Every step is still a REAL catalog query (never a slug used as
  // free text, never an invented product) and `widened` is reported so the
  // answer stays honest about how the match was found.
  let widened = false;
  let finalRanked = ranked;
  const text = understanding.q.slice(0, 120);
  // Widening ladder — the BUDGET is the customer's hardest constraint, so it
  // is dropped LAST: a same-budget alternative in a neighbouring category or
  // without the style filter is always a better suggestion than a pricier
  // product. Each step is still a REAL catalog query (never an invented row)
  // and `widened` is reported so the answer stays honest about the match.
  const relaxations: Record<string, unknown>[] = [
    // 1) drop colour/material (keep budget)
    { q: text, categorySlug: understanding.categorySlug, subCategorySlug: understanding.subCategorySlug, styleSlug: understanding.styleSlugs[0], rooms: understanding.rooms, minPrice: understanding.budget?.min, maxPrice: understanding.budget?.max, inStockOnly: true, limit: 120 },
    // 2) drop rooms (keep budget)
    { q: text, categorySlug: understanding.categorySlug, subCategorySlug: understanding.subCategorySlug, styleSlug: understanding.styleSlugs[0], minPrice: understanding.budget?.min, maxPrice: understanding.budget?.max, inStockOnly: true, limit: 120 },
    // 3) drop the style filter (keep budget)
    { q: text, categorySlug: understanding.categorySlug, subCategorySlug: understanding.subCategorySlug, minPrice: understanding.budget?.min, maxPrice: understanding.budget?.max, inStockOnly: true, limit: 120 },
    // 4) drop the sub-category (keep budget)
    { q: text, categorySlug: understanding.categorySlug, minPrice: understanding.budget?.min, maxPrice: understanding.budget?.max, inStockOnly: true, limit: 120 },
    // 5) structured filters only, no free text (keep budget)
    { categorySlug: understanding.categorySlug, subCategorySlug: understanding.subCategorySlug, styleSlug: understanding.styleSlugs[0], inStockOnly: true, limit: 120 },
    // 6) free text only (keep budget)
    { q: text, inStockOnly: true, limit: 120 },
    // 7) LAST resort: everything except the budget
    { q: text, categorySlug: understanding.categorySlug, subCategorySlug: understanding.subCategorySlug, styleSlug: understanding.styleSlugs[0], inStockOnly: true, limit: 120 },
  ];

  for (const query of relaxations) {
    if (finalRanked.length) break;
    const hasFilter = Object.entries(query).some(
      ([key, value]) => !["inStockOnly", "limit"].includes(key) && value !== undefined && value !== null && !(Array.isArray(value) && !value.length) && value !== "",
    );
    if (!hasFilter) continue;
    const relaxed = await ctx.callTool("searchProducts", query);
    const relaxedHits = ((relaxed.data as { items?: SearchHit[] })?.items ?? []).filter((item) => item && item.id);
    if (!relaxedHits.length) continue;
    const reranked = rankProducts(relaxedHits.map(toRankingProduct), { ...signals, freeText: undefined, colors: [], budget: undefined });
    if (reranked.length) {
      finalRanked = reranked;
      widened = true;
      ctx.log(`جستجو یک پله وسیع‌تر شد — ${reranked.length} محصول واقعی`);
    }
  }

  const products = finalRanked.slice(0, maxResults).map((entry, index) => ({
    ...toPublic(entry.product),
    score: entry.score,
    rank: index + 1,
    reasonCode: entry.reasonCode,
    reasonText: entry.reasonText,
  }));

  await rememberRequest(ctx, message, understanding);

  if (!products.length) {
    ctx.log("هیچ محصول واقعی منطبقی پیدا نشد");
    return {
      output: {
        dataState: "no_data",
        understanding: publicUnderstanding(understanding),
        products: [],
        count: 0,
        answer: `در کاتالوگ واقعی Homeino محصولی با این مشخصات پیدا نشد (${understanding.summary}). اگر بودجه یا رنگ را تغییر دهی دوباره جستجو می‌کنم.`,
      },
      dataState: "no_data",
    };
  }

  ctx.log(`${products.length} محصول واقعی برای «${understanding.summary}» پیدا شد`);

  return {
    output: {
      dataState: products.length >= Math.min(3, maxResults) ? "ok" : "not_enough_data",
      understanding: publicUnderstanding(understanding),
      products,
      count: products.length,
      widened,
      profileUsed: profile?.dataState === "ok",
      answer: buildAnswer(understanding, products, widened),
    },
    dataState: products.length >= Math.min(3, maxResults) ? "ok" : "not_enough_data",
  };
};

function toPublic(product: CatalogProduct): SearchHit {
  return {
    id: product.id,
    sku: product.sku ?? null,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    price: product.price,
    currency: product.currency,
    inStock: product.inStock,
    stockCount: product.stockCount,
    rating: product.rating,
    reviewsCount: product.reviewsCount,
    salesCount: product.salesCount,
    styleSlugs: product.styleSlugs,
    colors: product.colors,
    materials: product.materials,
    rooms: product.rooms,
    tags: product.tags,
    categorySlug: product.categorySlug ?? null,
    subCategorySlug: product.subCategorySlug ?? null,
    storeId: product.storeId,
    storeName: product.storeName ?? null,
    images: product.images.slice(0, 3),
    url: `/products/${product.slug}`,
  };
}

function buildAnswer(understanding: ShoppingIntent, products: SearchHit[], widened: boolean): string {
  const lines: string[] = [];
  const head = widened
    ? `دقیقاً با این مشخصات چیزی پیدا نشد؛ نزدیک‌ترین محصولات واقعی کاتالوگ برای «${understanding.summary}» این‌ها هستند:`
    : `${products.length} محصول واقعی برای «${understanding.summary}» پیدا کردم:`;
  lines.push(head);
  products.slice(0, 5).forEach((product, index) => {
    const store = product.storeName ? ` — فروشگاه ${product.storeName}` : "";
    lines.push(`${index + 1}. ${product.name} (${product.brand}) — ${formatPrice(product.price)} ${product.currency}${store}`);
  });
  if (understanding.budget?.max) {
    const within = products.filter((p) => p.price <= (understanding.budget?.max ?? Infinity)).length;
    if (within < products.length) lines.push(`توجه: ${products.length - within} مورد کمی بالاتر از بودجه‌ی توست.`);
  }
  return lines.join("\n");
}

function publicUnderstanding(understanding: ShoppingIntent) {
  return {
    isShopping: understanding.isShopping,
    confidence: Number(understanding.confidence.toFixed(2)),
    categorySlug: understanding.categorySlug ?? null,
    subCategorySlug: understanding.subCategorySlug ?? null,
    styleSlugs: understanding.styleSlugs,
    colors: understanding.colors,
    rooms: understanding.rooms,
    materials: understanding.materials,
    budget: understanding.budget ? { min: understanding.budget.min ?? null, max: understanding.budget.max ?? null, currency: understanding.budget.currency } : null,
    sku: understanding.sku,
    summary: understanding.summary,
  };
}

async function rememberRequest(ctx: Parameters<AgentHandler>[1], message: string, understanding: ShoppingIntent) {
  if (!ctx.userId) return;
  await ctx.callTool("remember", {
    userId: ctx.userId,
    kind: "request",
    key: `shopping:${Date.now()}`,
    text: message.slice(0, 240),
    value: { ...publicUnderstanding(understanding), at: new Date().toISOString() },
    importance: 2,
  });
}

/**
 * The LLM may only choose values that already exist in the Homeino vocabulary.
 * Anything else it returns is discarded — the deterministic parse stays.
 */
async function refineWithLlm(message: string, base: ShoppingIntent, ctx: Parameters<AgentHandler>[1]): Promise<ShoppingIntent> {
  const result = await ctx.callTool("llmComplete", {
    json: true,
    maxTokens: 260,
    system:
      "تو قصد خرید دکوراسیون را از یک جمله‌ی فارسی استخراج می‌کنی. فقط JSON برگردان و فقط از مقادیر مجاز هر فهرست استفاده کن. اگر مطمئن نیستی، null بگذار. هیچ شناسه، قیمت یا محصولی نساز.",
    prompt: JSON.stringify({
      message: message.slice(0, 600),
      allowed: {
        categorySlug: Object.keys(CATEGORY_KEYWORDS),
        subCategorySlug: Object.keys(SUBCATEGORY_KEYWORDS),
        styleSlugs: Object.keys(STYLE_KEYWORDS),
        colors: Object.keys(COLOR_KEYWORDS),
        rooms: Object.keys(ROOM_KEYWORDS),
      },
      deterministicHint: {
        categorySlug: base.categorySlug ?? null,
        subCategorySlug: base.subCategorySlug ?? null,
        styleSlugs: base.styleSlugs,
        colors: base.colors,
        rooms: base.rooms,
        budget: base.budget,
        sku: base.sku,
      },
    }),
  });

  if (!result.ok) return base;
  const raw = ((result.data as { data?: Record<string, unknown> })?.data ?? result.data) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return base;

  const pick = <T>(value: unknown, allowed: readonly string[]): T | undefined =>
    typeof value === "string" && allowed.includes(value) ? (value as T) : undefined;
  const pickMany = (value: unknown, allowed: readonly string[]): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && allowed.includes(v)) : [];

  const categorySlug = pick<string>(raw.categorySlug, Object.keys(CATEGORY_KEYWORDS)) ?? base.categorySlug;
  const subCategorySlug = pick<string>(raw.subCategorySlug, Object.keys(SUBCATEGORY_KEYWORDS)) ?? base.subCategorySlug;
  const styleSlugs = [...new Set([...base.styleSlugs, ...pickMany(raw.styleSlugs ?? raw.styles, Object.keys(STYLE_KEYWORDS))])];
  const colors = [...new Set([...base.colors, ...pickMany(raw.colors, Object.keys(COLOR_KEYWORDS))])];
  const rooms = [...new Set([...base.rooms, ...pickMany(raw.rooms ?? raw.room, Object.keys(ROOM_KEYWORDS))])];

  // Budget is numeric: only accept it when it is plausible (Toman).
  let budget = base.budget;
  const rawBudget = raw.budget as { min?: unknown; max?: unknown } | undefined;
  if (rawBudget && !budget) {
    const min = num(rawBudget.min, NaN);
    const max = num(rawBudget.max, NaN);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      budget = {
        min: Number.isFinite(min) && min > 0 ? min : undefined,
        max: Number.isFinite(max) && max > 0 ? max : undefined,
        currency: "تومان",
        raw: message,
      };
    }
  }

  const refined: ShoppingIntent = { ...base, categorySlug, subCategorySlug, styleSlugs, colors, rooms, budget };
  const signals = [Boolean(categorySlug || subCategorySlug), styleSlugs.length > 0, colors.length > 0, rooms.length > 0, Boolean(budget)].filter(Boolean).length;
  refined.confidence = Math.min(1, Math.max(base.confidence, 0.25 + signals * 0.15));
  return refined;
}
