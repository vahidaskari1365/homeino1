// ============================================================
// HOMEINO — VENDOR AGENT
//
// Prompt Stage 4.5: for each store/vendor report performance —
// profile, product count, price bands, stock health — and turn the
// findings into admin/vendor tasks. Read-only on the catalog: it
// never edits stock or prices (that stays behind human approval).
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";

interface VendorSummary {
  id?: string;
  name?: string;
  slug?: string;
  rating?: number | string;
  salesCount?: number;
  followersCount?: number;
  productCount?: number;
  city?: string | null;
  status?: string;
}

interface ProductLite {
  id?: string;
  name?: string;
  price?: number;
  stockCount?: number;
}

export const runVendorAgent: AgentHandler = async (input, ctx) => {
  const vendorSlug = str(input.vendorSlug ?? ctx.agent.config?.vendorSlug);
  const vendorId = str(input.vendorId ?? ctx.agent.config?.vendorId);

  const vendorResult = await ctx.callTool("getVendor", {
    vendorId: vendorId,
    vendorSlug: vendorSlug,
  });
  if (!vendorResult.ok) {
    ctx.log("خواندن فروشنده ناموفق بود", { error: vendorResult.error });
    return {
      output: { dataState: "no_data", reason: vendorResult.error ?? "vendor_query_failed" },
      dataState: "no_data",
    };
  }

  const data = vendorResult.data as { found?: boolean; vendor?: VendorSummary };
  const vendor = data.vendor;
  if (!data.found || !vendor?.id) {
    ctx.log("فروشنده پیدا نشد");
    return {
      output: { dataState: "no_data", reason: "vendor_not_found" },
      dataState: "no_data",
    };
  }

  // Real products of this store — read-only.
  const productsResult = await ctx.callTool("searchProducts", { storeId: vendor.id, limit: 200 });
  const items = productsResult.ok ? (((productsResult.data as { items?: ProductLite[] }).items ?? [])) : [];
  const withStock = items.filter((p) => typeof p.stockCount === "number");
  const lowStock = withStock.filter((p) => (p.stockCount ?? 0) <= num(ctx.agent.config?.lowStockThreshold, 3));
  const prices = items.map((p) => num(p.price, 0)).filter((p) => p > 0);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const taskIdResult = await ctx.callTool("createTask", {
    title: `گزارش عملکرد فروشگاه ${vendor.name ?? vendor.id}`,
    type: "vendor_performance_report",
    priority: 3,
    assigneeRole: "admin",
    payload: {
      vendorId: vendor.id,
      vendorSlug: vendor.slug ?? null,
      productCount: items.length,
      lowStockCount: lowStock.length,
      avgPrice,
      rating: vendor.rating ?? null,
      salesCount: vendor.salesCount ?? null,
      runId: ctx.runId,
    },
  });

  if (lowStock.length > 0) {
    await ctx.callTool("sendNotification", {
      audience: "vendor",
      type: "vendor_low_stock",
      title: `${lowStock.length} محصول فروشگاه شما نیاز به شارژ موجودی دارد`,
      body: lowStock.slice(0, 5).map((p) => `${p.name ?? p.id} — موجودی ${p.stockCount ?? 0}`).join("، "),
      payload: { vendorId: vendor.id },
    });
  }

  ctx.log(`گزارش فروشنده ${vendor.name ?? vendor.id} با ${items.length} محصول ساخته شد`);

  return {
    output: {
      dataState: "ok",
      vendor,
      metrics: {
        productCount: items.length,
        lowStockCount: lowStock.length,
        avgPrice,
        outOfStock: withStock.filter((p) => (p.stockCount ?? 0) === 0).length,
      },
      lowStockItems: lowStock.slice(0, 20),
      taskId: str((taskIdResult.data as { taskId?: string })?.taskId) ?? null,
      summary: `${vendor.name ?? "فروشگاه"} — ${items.length} محصول، ${lowStock.length} کم‌موجود، میانگین قیمت ${avgPrice}`,
    },
    dataState: "ok",
  };
};
