// ============================================================
// HOMEINO — AI DESIGNER BRIDGE AGENT
//
// Connects the existing AI Designer to the agent system:
//
//   SKU → exact DB lookup → real product → design → same product preserved
//   SKU not found → "sku_not_found" (never a substitute, never a fake product)
//
//   Room/style/color context → real product matching → recommendations saved
//   for the `ai_designer` scenario → the designer can render real product cards
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";

interface MatchedProduct {
  id: string;
  sku?: string | null;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockCount: number;
  styleSlugs: string[];
  colors: string[];
  materials: string[];
  rooms: string[];
  categorySlug?: string | null;
  subCategorySlug?: string | null;
  storeId: string;
  storeName?: string | null;
  images?: string[];
  url: string;
  score?: number;
  rank?: number;
  reasonCode?: string;
  reasonText?: string;
}

export const runDesignerAgent: AgentHandler = async (input, ctx) => {
  const sku = str(input.sku) ?? str(input.productCode) ?? null;
  const room = str(input.room) ?? str(input.roomType) ?? null;
  const style = str(input.style) ?? null;
  const colors = Array.isArray(input.colors) ? (input.colors as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const targets = Array.isArray(input.targets) ? (input.targets as unknown[]).filter((t): t is string => typeof t === "string") : [];
  const budgetRaw = input.budget as { min?: unknown; max?: unknown } | undefined;
  const limit = Math.min(Math.max(1, num(input.limit, 6)), 20);

  // ---- 1. explicit SKU: exact lookup, preserved through the design ----
  let preserved: MatchedProduct | null = null;
  let skuStatus: "none" | "found" | "not_found" = "none";

  if (sku) {
    const resolved = await ctx.callTool("matchProductsBySku", { sku });
    const data = resolved.data as { status?: string; product?: MatchedProduct; message?: string } | undefined;
    if (resolved.ok && data?.status === "found" && data.product) {
      preserved = data.product;
      skuStatus = "found";
      ctx.log(`محصول واقعی برای SKU ${sku} پیدا شد: ${preserved.name}`);
    } else {
      skuStatus = "not_found";
      ctx.log(`SKU ${sku} در کاتالوگ نیست — هیچ محصول جایگزینی ساخته نمی‌شود`);
      return {
        output: {
          dataState: "no_data",
          skuStatus: "not_found",
          sku,
          preservedProduct: null,
          matchedProducts: [],
          message: data?.message ?? `کد محصول «${sku}» در کاتالوگ Homeino پیدا نشد.`,
        },
        dataState: "no_data",
      };
    }
  }

  // ---- 2. match real products for the design context ----
  const search = await ctx.callTool("searchProducts", {
    styleSlug: style ?? undefined,
    colors: colors.length ? colors : undefined,
    rooms: room ? [room] : undefined,
    q: targets.length ? targets.join(" ") : undefined,
    minPrice: budgetRaw?.min === undefined ? undefined : num(budgetRaw.min, NaN) || undefined,
    maxPrice: budgetRaw?.max === undefined ? undefined : num(budgetRaw.max, NaN) || undefined,
    inStockOnly: true,
    limit: 60,
  });

  const matched = ((search.data as { items?: MatchedProduct[] })?.items ?? [])
    .filter((item) => item && item.id && (!preserved || item.id !== preserved.id))
    .slice(0, limit);

  // ---- 3. persist as recommendations for the designer scenario ----
  const itemsForSave = [...(preserved ? [{ ...preserved, score: 1, reasonCode: "sku_preserved", reasonText: "همان محصولی که انتخاب کردی" }] : []), ...matched];
  let persisted = 0;
  if (itemsForSave.length) {
    const saved = await ctx.callTool("createRecommendation", {
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      scenario: "ai_designer",
      items: itemsForSave.map((item, index) => ({
        productId: item.id,
        slug: item.slug,
        sku: item.sku ?? undefined,
        name: item.name,
        price: item.price,
        score: item.score ?? 0,
        rank: index + 1,
        reasonCode: item.reasonCode ?? "design_match",
        reasonText: item.reasonText ?? "منطبق با فضای طراحی‌شده",
        breakdown: {},
      })),
    });
    persisted = num((saved.data as { persisted?: number })?.persisted, 0);
  }

  // ---- 4. remember the design request ----
  if (ctx.userId) {
    await ctx.callTool("remember", {
      userId: ctx.userId,
      kind: "design",
      key: `design:${str(input.designId) ?? Date.now()}`,
      text: [room, style, colors.join(" و "), targets.join(" و ")].filter(Boolean).join(" — "),
      value: { room, style, colors, targets, sku, preservedProductId: preserved?.id ?? null, matched: matched.length },
      importance: 3,
      entityType: preserved ? "product" : "design",
      entityId: preserved?.id ?? str(input.designId),
    });
  }

  const dataState = preserved || matched.length ? "ok" : "not_enough_data";

  return {
    output: {
      dataState,
      skuStatus,
      sku,
      preservedProduct: preserved,
      matchedProducts: matched,
      count: itemsForSave.length,
      persisted,
      context: { room, style, colors, targets, budget: budgetRaw ?? null },
      message: preserved
        ? `محصول «${preserved.name}» در طرح حفظ شد و ${matched.length} محصول واقعی هماهنگ با آن پیدا شد.`
        : matched.length
          ? `${matched.length} محصول واقعی هماهنگ با فضای طراحی‌شده پیدا شد.`
          : "برای این فضا محصول منطبقی در کاتالوگ واقعی پیدا نشد.",
    },
    dataState,
  };
};
