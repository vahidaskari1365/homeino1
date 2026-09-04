// ============================================================
// HOMEINO — INVENTORY AGENT
//
// Manual or scheduled: queries real low-stock products, creates admin/vendor
// tasks and logs the result. It never edits stock or prices by itself — any
// write to a product requires a human approval.
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";

interface LowStockItem {
  id?: string;
  productId?: string;
  name?: string;
  sku?: string | null;
  stockCount?: number;
  storeName?: string | null;
  storeId?: string;
  url?: string;
}

export const runInventoryAgent: AgentHandler = async (input, ctx) => {
  const threshold = num(input.threshold ?? ctx.agent.config?.threshold, 5);

  const result = await ctx.callTool("getLowStockProducts", { threshold });
  if (!result.ok) {
    ctx.log("کوئری موجودی ناموفق بود", { error: result.error });
    return {
      output: { dataState: "no_data", reason: result.error ?? "query_failed", count: 0, items: [], threshold },
      dataState: "no_data",
    };
  }

  const data = result.data as { count?: number; items?: LowStockItem[] };
  const items = data.items ?? [];

  if (!items.length) {
    ctx.log(`هیچ محصولی زیر آستانه ${threshold} نیست`);
    return {
      output: {
        dataState: "ok",
        threshold,
        count: 0,
        items: [],
        taskIds: [],
        summary: `هیچ محصولی با موجودی کمتر از ${threshold} پیدا نشد.`,
      },
      dataState: "ok",
    };
  }

  // One aggregate admin task (keeps the queue readable) + per-vendor notices.
  const taskIds: string[] = [];
  const aggregate = await ctx.callTool("createTask", {
    title: `${items.length} محصول با موجودی کم (آستانه ${threshold})`,
    type: "inventory_low_stock",
    priority: 2,
    assigneeRole: "admin",
    payload: {
      threshold,
      count: items.length,
      items: items.slice(0, 25).map((item) => ({
        productId: item.productId ?? item.id,
        name: item.name,
        sku: item.sku ?? null,
        stockCount: item.stockCount,
        storeId: item.storeId ?? null,
        url: item.url ?? null,
      })),
      runId: ctx.runId,
    },
  });
  if (aggregate.ok && str((aggregate.data as { taskId?: string })?.taskId)) {
    taskIds.push(String((aggregate.data as { taskId?: string }).taskId));
  }

  if (ctx.agent.config?.notifyVendor !== false) {
    const byStore = new Map<string, LowStockItem[]>();
    for (const item of items) {
      const key = item.storeId ?? "unknown";
      byStore.set(key, [...(byStore.get(key) ?? []), item]);
    }
    for (const [storeId, storeItems] of byStore) {
      if (storeId === "unknown") continue;
      const notice = await ctx.callTool("sendNotification", {
        audience: "vendor",
        type: "inventory_low_stock",
        title: `${storeItems.length} محصول فروشگاه شما موجودی کم دارد`,
        body: storeItems
          .slice(0, 5)
          .map((item) => `${item.name ?? item.productId ?? item.id} — موجودی ${item.stockCount ?? 0}`)
          .join("، "),
        payload: { storeId, threshold },
      });
      const taskId = str((notice.data as { taskId?: string })?.taskId);
      if (taskId) taskIds.push(taskId);
    }
  }

  if (ctx.agent.config?.notifyAdmin !== false) {
    await ctx.callTool("sendNotification", {
      audience: "admin",
      type: "inventory_low_stock",
      title: "گزارش موجودی کم",
      body: `${items.length} محصول زیر آستانه ${threshold} است.`,
      payload: { threshold, count: items.length },
    });
  }

  ctx.log(`${items.length} محصول کم‌موجود → ${taskIds.length} وظیفه ساخته شد`);

  return {
    output: {
      dataState: "ok",
      threshold,
      count: items.length,
      items: items.slice(0, 50),
      taskIds,
      summary: `${items.length} محصول با موجودی کمتر از ${threshold} پیدا شد و ${taskIds.length} وظیفه ثبت شد.`,
    },
    dataState: "ok",
  };
};
