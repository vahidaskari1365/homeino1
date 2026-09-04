// ============================================================
// HOMEINO — TOOL REGISTRY (executable side)
//
// Agents never touch the database or the catalog directly: they call tools.
// Every tool declares the permission it needs; the runtime refuses the call
// when the agent does not hold it (and pauses for approval when required).
//
// Tool metadata for seeding lives in defaults.ts (BUILTIN_TOOLS) — a unit test
// keeps the two lists in sync.
// ============================================================
import { orders, notifications } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { AgentToolDefinition, ToolCallContext } from "./types";
import { getStore, hasDatabase } from "./store";
import {
  catalogPool,
  findCatalogProduct,
  findCatalogProductBySku,
  lowStockCatalog,
  searchCatalog,
  type CatalogProduct,
} from "./catalog";
import { complete, completeJson } from "./llmGateway";
import { computeCustomerProfile, effectiveProfile } from "../memory/preferenceEngine";
import { customerMemory } from "../memory/customerMemory";
import { generateRecommendations, recordRecommendationFeedback } from "../recommendations/recommendationEngine";
import { verifyRealProducts } from "../recommendations/productMatching";
import type { MemoryKind } from "./types";

const num = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? fallback) || fallback);
const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** Compact, UI-safe shape of a REAL catalog product. */
export function publicProduct(product: CatalogProduct) {
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
    styleSlugs: product.styleSlugs,
    colors: product.colors,
    materials: product.materials,
    rooms: product.rooms,
    categorySlug: product.categorySlug ?? null,
    subCategorySlug: product.subCategorySlug ?? null,
    storeId: product.storeId,
    storeName: product.storeName ?? null,
    images: product.images.slice(0, 3),
    url: `/products/${product.slug}`,
    source: product.source,
  };
}

export const TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    key: "getProduct",
    name: "دریافت محصول",
    description: "خواندن یک محصول واقعی از کاتالوگ با id، slug یا SKU",
    category: "catalog",
    requiredPermission: "READ_PRODUCTS",
    inputSchema: { productId: "string?", slug: "string?", sku: "string?" },
    async execute(input) {
      const product = await findCatalogProduct({ id: str(input.productId), slug: str(input.slug), sku: str(input.sku) });
      if (!product) return { found: false, reason: "product_not_in_catalog" };
      return { found: true, product: publicProduct(product) };
    },
  },
  {
    key: "searchProducts",
    name: "جستجوی محصول",
    description: "جستجوی واقعی در کاتالوگ با فیلترهای سبک/رنگ/قیمت/دسته",
    category: "catalog",
    requiredPermission: "READ_PRODUCTS",
    inputSchema: { q: "string?", categorySlug: "string?", styleSlug: "string?", colors: "string[]?", minPrice: "number?", maxPrice: "number?", limit: "number?" },
    async execute(input) {
      const items = await searchCatalog({
        q: str(input.q),
        categorySlug: str(input.categorySlug),
        subCategorySlug: str(input.subCategorySlug),
        styleSlug: str(input.styleSlug),
        storeId: str(input.storeId),
        colors: Array.isArray(input.colors) ? (input.colors as string[]) : undefined,
        materials: Array.isArray(input.materials) ? (input.materials as string[]) : undefined,
        rooms: Array.isArray(input.rooms) ? (input.rooms as string[]) : undefined,
        minPrice: input.minPrice === undefined ? undefined : num(input.minPrice),
        maxPrice: input.maxPrice === undefined ? undefined : num(input.maxPrice),
        inStockOnly: input.inStockOnly === true,
        limit: num(input.limit, 24),
      });
      return { count: items.length, items: items.map(publicProduct) };
    },
  },
  {
    key: "listProducts",
    name: "فهرست محصولات",
    description: "فهرست محصولات فعال کاتالوگ",
    category: "catalog",
    requiredPermission: "READ_PRODUCTS",
    inputSchema: { limit: "number?" },
    async execute(input) {
      const limit = num(input.limit, 100);
      const pool = await catalogPool();
      return { count: Math.min(pool.length, limit), total: pool.length, items: pool.slice(0, limit).map(publicProduct) };
    },
  },
  {
    key: "matchProductsBySku",
    name: "تطبیق SKU",
    description: "یافتن محصول واقعی با SKU — SKU ناشناخته یعنی not_found",
    category: "catalog",
    requiredPermission: "READ_PRODUCTS",
    inputSchema: { sku: "string" },
    async execute(input) {
      const sku = str(input.sku) ?? "";
      if (!sku) return { status: "empty" };
      const product = await findCatalogProductBySku(sku);
      if (!product) return { status: "not_found", sku, message: `کد محصول «${sku}» در کاتالوگ پیدا نشد.` };
      return { status: "found", sku, product: publicProduct(product) };
    },
  },
  {
    key: "getInventory",
    name: "موجودی",
    description: "وضعیت موجودی یک محصول واقعی",
    category: "catalog",
    requiredPermission: "READ_INVENTORY",
    inputSchema: { productId: "string" },
    async execute(input) {
      const product = await findCatalogProduct({ id: str(input.productId), slug: str(input.productId) });
      if (!product) return { found: false };
      return { found: true, productId: product.id, inStock: product.inStock, stockCount: product.stockCount };
    },
  },
  {
    key: "getLowStockProducts",
    name: "محصولات کم‌موجود",
    description: "محصولاتی که موجودی‌شان زیر آستانه است",
    category: "catalog",
    requiredPermission: "READ_INVENTORY",
    inputSchema: { threshold: "number?" },
    async execute(input) {
      const threshold = num(input.threshold, 5);
      const items = await lowStockCatalog(threshold);
      return {
        threshold,
        count: items.length,
        items: items.map((p) => ({ ...publicProduct(p), stockCount: p.stockCount })),
      };
    },
  },
  {
    key: "getCustomer",
    name: "پروفایل مشتری",
    description: "خواندن پروفایل محاسبه‌شده مشتری",
    category: "customer",
    requiredPermission: "READ_CUSTOMERS",
    inputSchema: { userId: "string?" },
    async execute(input, ctx) {
      const userId = str(input.userId) ?? ctx.userId ?? undefined;
      if (!userId) return { found: false, reason: "no_user" };
      const store = await getStore();
      const profile = await store.getProfile(userId);
      return { found: Boolean(profile), userId, profile: profile ?? null };
    },
  },
  {
    key: "getCustomerPreferences",
    name: "ترجیحات مشتری",
    description: "ترجیحات استخراج‌شده از رفتار واقعی (بدون حدس)",
    category: "customer",
    requiredPermission: "READ_CUSTOMERS",
    inputSchema: { userId: "string?", sessionId: "string?", recompute: "boolean?" },
    async execute(input, ctx) {
      const userId = str(input.userId) ?? ctx.userId ?? null;
      const sessionId = str(input.sessionId) ?? ctx.sessionId ?? null;
      if (!userId && !sessionId) return { dataState: "no_data", profile: null };
      const profile = input.recompute === true
        ? await computeCustomerProfile({ userId, sessionId, persist: Boolean(userId), agentKey: ctx.agentKey, runId: ctx.runId ?? undefined })
        : await effectiveProfile({ userId, sessionId });
      return { dataState: profile?.dataState ?? "no_data", profile: profile ?? null };
    },
  },
  {
    key: "getCustomerEvents",
    name: "رویدادهای مشتری",
    description: "رویدادهای رفتاری ثبت‌شده برای مشتری/نشست",
    category: "analytics",
    requiredPermission: "READ_ANALYTICS",
    inputSchema: { userId: "string?", sessionId: "string?", limit: "number?", eventTypes: "string[]?" },
    async execute(input, ctx) {
      const store = await getStore();
      const events = await store.listEvents({
        userId: str(input.userId) ?? ctx.userId ?? undefined,
        sessionId: str(input.sessionId) ?? ctx.sessionId ?? undefined,
        eventTypes: Array.isArray(input.eventTypes) ? (input.eventTypes as string[]) : undefined,
        limit: num(input.limit, 200),
      });
      return { count: events.length, events };
    },
  },
  {
    key: "getOrders",
    name: "سفارش‌ها",
    description: "سفارش‌های واقعی مشتری (نیازمند دیتابیس)",
    category: "commerce",
    requiredPermission: "READ_ORDERS",
    inputSchema: { userId: "string?", limit: "number?" },
    async execute(input, ctx) {
      if (!hasDatabase()) return { count: 0, orders: [], dataState: "no_data", reason: "database_not_configured" };
      const userId = str(input.userId) ?? ctx.userId;
      if (!userId) return { count: 0, orders: [], dataState: "no_data" };
      const { getDb } = await import("@/db");
      const rows = await getDb()
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(Math.min(num(input.limit, 20), 100));
      return {
        count: rows.length,
        dataState: rows.length ? "ok" : "no_data",
        orders: rows.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, total: o.total, currency: o.currency, placedAt: o.placedAt })),
      };
    },
  },
  {
    key: "getWishlist",
    name: "علاقه‌مندی‌ها",
    description: "علاقه‌مندی‌های ثبت‌شده مشتری",
    category: "commerce",
    requiredPermission: "READ_CUSTOMERS",
    inputSchema: { userId: "string?" },
    async execute(input, ctx) {
      const store = await getStore();
      const events = await store.listEvents({
        userId: str(input.userId) ?? ctx.userId ?? undefined,
        sessionId: ctx.sessionId ?? undefined,
        eventTypes: ["wishlist_add", "product_favorited"],
        limit: 100,
      });
      const ids = [...new Set(events.map((e) => e.entityId).filter((v): v is string => Boolean(v)))];
      const products = (await Promise.all(ids.map((id) => findCatalogProduct({ id, slug: id })))).filter((p): p is CatalogProduct => Boolean(p));
      return { count: products.length, items: products.map(publicProduct) };
    },
  },
  {
    key: "getCart",
    name: "سبد خرید",
    description: "محصولات افزوده‌شده به سبد خرید",
    category: "commerce",
    requiredPermission: "READ_ORDERS",
    inputSchema: { userId: "string?" },
    async execute(input, ctx) {
      const store = await getStore();
      const events = await store.listEvents({
        userId: str(input.userId) ?? ctx.userId ?? undefined,
        sessionId: ctx.sessionId ?? undefined,
        eventTypes: ["cart_add", "add_to_cart"],
        limit: 100,
      });
      const removed = new Set(
        (await store.listEvents({ userId: str(input.userId) ?? ctx.userId ?? undefined, eventTypes: ["cart_remove", "remove_from_cart"], limit: 100 })).map((e) => e.entityId),
      );
      const ids = [...new Set(events.map((e) => e.entityId).filter((v): v is string => Boolean(v) && !removed.has(v)))];
      const products = (await Promise.all(ids.map((id) => findCatalogProduct({ id, slug: id })))).filter((p): p is CatalogProduct => Boolean(p));
      return { count: products.length, items: products.map(publicProduct) };
    },
  },
  {
    key: "updateCustomerProfile",
    name: "به‌روزرسانی پروفایل مشتری",
    description: "ذخیره پروفایل محاسبه‌شده توسط ایجنت",
    category: "customer",
    requiredPermission: "WRITE_CUSTOMER_PROFILE",
    inputSchema: { userId: "string?", profile: "object?" },
    async execute(input, ctx) {
      const userId = str(input.userId) ?? ctx.userId;
      if (!userId) return { ok: false, reason: "no_user" };
      const profile = await computeCustomerProfile({
        userId,
        sessionId: ctx.sessionId ?? null,
        persist: true,
        agentKey: ctx.agentKey,
        runId: ctx.runId ?? undefined,
      });
      return { ok: true, userId, dataState: profile.dataState, confidence: profile.confidence, profile };
    },
  },
  {
    key: "remember",
    name: "ثبت حافظه",
    description: "افزودن/به‌روزرسانی حافظه بلندمدت مشتری",
    category: "memory",
    requiredPermission: "WRITE_CUSTOMER_MEMORY",
    inputSchema: { userId: "string?", kind: "string", key: "string", text: "string?", value: "object?" },
    async execute(input, ctx) {
      const userId = str(input.userId) ?? ctx.userId;
      if (!userId) return { ok: false, reason: "no_user" };
      const kind = (str(input.kind) ?? "note") as MemoryKind;
      const key = str(input.key);
      if (!key) return { ok: false, reason: "missing_key" };
      const record = await customerMemory.remember(userId, {
        kind,
        key,
        text: str(input.text),
        value: (input.value as Record<string, unknown> | undefined) ?? {},
        importance: num(input.importance, 1),
        agentKey: ctx.agentKey,
        runId: ctx.runId ?? undefined,
      });
      return { ok: Boolean(record), memory: record };
    },
  },
  {
    key: "recall",
    name: "بازیابی حافظه",
    description: "جستجوی حافظه مشتری",
    category: "memory",
    requiredPermission: "READ_CUSTOMERS",
    inputSchema: { userId: "string?", query: "string?", kind: "string?", limit: "number?" },
    async execute(input, ctx) {
      const userId = str(input.userId) ?? ctx.userId;
      if (!userId) return { count: 0, memories: [] };
      const memories = await customerMemory.recall(userId, str(input.query) ?? "", {
        kind: str(input.kind) as MemoryKind | undefined,
        limit: num(input.limit, 12),
      });
      return { count: memories.length, memories };
    },
  },
  {
    key: "createRecommendation",
    name: "ساخت پیشنهاد",
    description: "ذخیره پیشنهاد محصولات واقعی (فقط محصولات موجود در کاتالوگ)",
    category: "recommendation",
    requiredPermission: "WRITE_RECOMMENDATIONS",
    inputSchema: { userId: "string?", sessionId: "string?", scenario: "string", items: "array?", seedProductId: "string?", limit: "number?" },
    async execute(input, ctx) {
      const userId = str(input.userId) ?? ctx.userId ?? null;
      const sessionId = str(input.sessionId) ?? ctx.sessionId ?? null;
      const scenario = str(input.scenario) ?? "home";
      const rawItems = Array.isArray(input.items) ? (input.items as unknown[]) : [];

      // Guard: if the caller passed items, verify each one against the catalog.
      if (rawItems.length) {
        const { verified, rejected } = await verifyRealProducts(rawItems);
        const store = await getStore();
        const persisted = await store.saveRecommendations({
          userId,
          sessionId,
          scenario,
          agentKey: ctx.agentKey,
          runId: ctx.runId ?? null,
          replace: true,
          items: verified.map((item, index) => ({
            productId: item.product.id,
            vendorId: null,
            score: item.score ?? 0,
            rank: item.rank ?? index + 1,
            reasonCode: item.reasonCode,
            reasonText: item.reasonText,
            breakdown: item.breakdown,
          })),
        });
        return { ok: true, persisted, rejected: rejected.length, dataState: persisted ? "ok" : "no_data" };
      }

      const result = await generateRecommendations({
        userId,
        sessionId,
        scenario,
        limit: num(input.limit, 12),
        seedProductId: str(input.seedProductId) ?? null,
        persist: true,
        agentKey: ctx.agentKey,
        runId: ctx.runId ?? null,
      });
      return {
        ok: true,
        persisted: result.persisted,
        dataState: result.dataState,
        source: result.source,
        count: result.items.length,
        items: result.items.map((item) => ({ ...publicProduct(item.product), score: item.score, rank: item.rank, reasonCode: item.reasonCode, reasonText: item.reasonText })),
      };
    },
  },
  {
    key: "createTask",
    name: "ساخت وظیفه",
    description: "افزودن وظیفه به صف وظایف",
    category: "automation",
    requiredPermission: "WRITE_TASKS",
    inputSchema: { title: "string", type: "string?", payload: "object?", priority: "number?", assigneeRole: "string?" },
    async execute(input, ctx) {
      const title = str(input.title);
      if (!title) return { ok: false, reason: "missing_title" };
      const store = await getStore();
      const taskId = await store.createTask({
        title,
        type: str(input.type) ?? "generic",
        priority: num(input.priority, 0),
        agentKey: ctx.agentKey,
        workflowRunId: ctx.runId ?? null,
        userId: ctx.userId ?? null,
        payload: (input.payload as Record<string, unknown> | undefined) ?? {},
        assigneeRole: str(input.assigneeRole) ?? "admin",
      });
      await store.addTaskLog(taskId, "info", `وظیفه توسط ایجنت ${ctx.agentKey} ساخته شد`, { runId: ctx.runId ?? null });
      return { ok: true, taskId };
    },
  },
  {
    key: "sendNotification",
    name: "ارسال اعلان",
    description: "ثبت اعلان داخلی برای کاربر یا ادمین",
    category: "automation",
    requiredPermission: "SEND_NOTIFICATION",
    inputSchema: { userId: "string?", audience: "string?", type: "string", title: "string", body: "string?" },
    async execute(input, ctx) {
      const title = str(input.title);
      if (!title) return { ok: false, reason: "missing_title" };
      const audience = str(input.audience) ?? "user";
      const userId = str(input.userId) ?? (audience === "user" ? ctx.userId ?? undefined : undefined);
      const store = await getStore();

      if (audience === "user" && userId && hasDatabase()) {
        const { getDb } = await import("@/db");
        await getDb().insert(notifications).values({
          userId,
          type: str(input.type) ?? "agent",
          title,
          body: str(input.body) ?? null,
          data: { agentKey: ctx.agentKey, runId: ctx.runId ?? null },
        });
        return { ok: true, channel: "notification", userId };
      }

      // Admin/vendor audiences (and database-less mode) become a queue task so
      // the message is never silently dropped.
      const taskId = await store.createTask({
        title,
        type: "notification",
        agentKey: ctx.agentKey,
        workflowRunId: ctx.runId ?? null,
        userId: userId ?? null,
        assigneeRole: audience === "vendor" ? "vendor" : "admin",
        payload: { body: str(input.body) ?? "", notificationType: str(input.type) ?? "agent", audience },
      });
      return { ok: true, channel: "task", taskId };
    },
  },
  {
    key: "requestApproval",
    name: "درخواست تأیید انسانی",
    description: "ثبت درخواست تأیید برای اقدام پرخطر",
    category: "automation",
    requiredPermission: "REQUEST_APPROVAL",
    inputSchema: { action: "string", reason: "string?", risk: "string?", payload: "object?" },
    async execute(input, ctx) {
      const action = str(input.action);
      if (!action) return { ok: false, reason: "missing_action" };
      const store = await getStore();
      const risk = (["low", "medium", "high", "critical"].includes(str(input.risk) ?? "") ? str(input.risk) : "high") as "low" | "medium" | "high" | "critical";
      const approvalId = await store.createApproval({
        agentKey: ctx.agentKey,
        runId: ctx.runId ?? null,
        action,
        reason: str(input.reason),
        riskLevel: risk,
        payload: (input.payload as Record<string, unknown> | undefined) ?? {},
      });
      return { ok: true, approvalId, status: "pending" };
    },
  },
  {
    key: "llmComplete",
    name: "فراخوانی LLM",
    description: "فراخوانی ساختاریافته لایه LLM (پروایدر قابل تعویض)",
    category: "ai",
    requiredPermission: "CALL_LLM",
    inputSchema: { system: "string?", prompt: "string", json: "boolean?", maxTokens: "number?", provider: "string?" },
    async execute(input, ctx) {
      const prompt = str(input.prompt);
      if (!prompt) return { ok: false, reason: "missing_prompt" };
      const request = {
        system: str(input.system),
        prompt,
        maxTokens: num(input.maxTokens, 400),
        agentKey: ctx.agentKey,
        provider: str(input.provider) as never,
      };
      const result = input.json === true ? await completeJson(request) : await complete(request);
      ctx.addUsage({
        provider: result.provider,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costMicro: result.costMicro,
      });
      return {
        ok: true,
        text: result.text,
        data: "data" in result ? result.data ?? null : null,
        provider: result.provider,
        model: result.model,
        degraded: result.degraded,
        usage: { tokensIn: result.tokensIn, tokensOut: result.tokensOut, costMicro: result.costMicro },
      };
    },
  },
  {
    key: "httpRequest",
    name: "درخواست HTTP",
    description: "درخواست به دامنه مجاز (allowlist) — نیازمند تأیید انسانی",
    category: "integration",
    requiredPermission: "EXTERNAL_ACTION",
    requiresApproval: true,
    inputSchema: { url: "string", method: "string?", body: "object?" },
    async execute(input) {
      const { runHttpTask } = await import("./integrations/httpRuntime");
      return runHttpTask({ url: str(input.url) ?? "", method: str(input.method) ?? "GET", body: input.body as Record<string, unknown> | undefined });
    },
  },
  {
    key: "browserTask",
    name: "وظیفه مرورگر",
    description: "اجرای وظیفه مرورگری روی دامنه مجاز (Browser Use / Stagehand)",
    category: "integration",
    requiredPermission: "BROWSER_AUTOMATION",
    requiresApproval: true,
    inputSchema: { url: "string", instruction: "string", action: "string?", allowedDomains: "string[]?" },
    async execute(input, ctx) {
      const { resolveBrowserRuntime } = await import("./integrations/browserRuntime");
      const runtime = resolveBrowserRuntime();
      return runtime.run({
        url: str(input.url) ?? "",
        instruction: str(input.instruction) ?? "",
        action: (str(input.action) as "goto" | "act" | "extract" | "observe") ?? "extract",
        allowedDomains: Array.isArray(input.allowedDomains) ? (input.allowedDomains as string[]) : [],
        maxSteps: num(input.maxSteps, 8),
        schema: input.schema as Record<string, string> | undefined,
        agentKey: ctx.agentKey,
        runId: ctx.runId ?? null,
      });
    },
  },
  {
    key: "updateProductPrice",
    name: "تغییر قیمت محصول",
    description: "تغییر قیمت — فقط با تأیید انسانی اجرا می‌شود",
    category: "danger",
    requiredPermission: "WRITE_PRODUCTS",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: { productId: "string", price: "number" },
    async execute(input) {
      // The agent may only *request* this change — execution happens in
      // automation/approvals.ts after an admin approves it.
      const product = await findCatalogProduct({ id: str(input.productId), slug: str(input.productId) });
      if (!product) return { ok: false, reason: "product_not_in_catalog" };
      return { ok: false, pendingApproval: true, productId: product.id, currentPrice: product.price, requestedPrice: num(input.price) };
    },
  },
  {
    key: "cancelOrder",
    name: "لغو سفارش",
    description: "لغو سفارش — فقط با تأیید انسانی",
    category: "danger",
    requiredPermission: "ORDER_CANCEL",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: { orderId: "string" },
    async execute() {
      return { ok: false, pendingApproval: true, reason: "human_approval_required" };
    },
  },
  {
    key: "refundPayment",
    name: "بازگشت وجه",
    description: "بازگشت وجه — فقط با تأیید انسانی",
    category: "danger",
    requiredPermission: "REFUND",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: { orderId: "string", amount: "number" },
    async execute() {
      return { ok: false, pendingApproval: true, reason: "human_approval_required" };
    },
  },
  {
    key: "deleteEntity",
    name: "حذف موجودیت",
    description: "حذف داده — فقط با تأیید انسانی",
    category: "danger",
    requiredPermission: "DATABASE_DESTRUCTIVE_WRITE",
    requiresApproval: true,
    isDestructive: true,
    inputSchema: { entity: "string", id: "string" },
    async execute() {
      return { ok: false, pendingApproval: true, reason: "human_approval_required" };
    },
  },
];

const TOOL_MAP = new Map(TOOL_DEFINITIONS.map((tool) => [tool.key, tool]));

export function getTool(key: string): AgentToolDefinition | undefined {
  return TOOL_MAP.get(key);
}

export function listToolDefinitions(): AgentToolDefinition[] {
  return TOOL_DEFINITIONS;
}

/** Tools visible to an agent = granted ∩ (permission held) ∩ active. */
export function toolsForAgent(grantedTools: string[], permissions: string[]): AgentToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => grantedTools.includes(tool.key) && permissions.includes(tool.requiredPermission));
}

/** Execute a tool with full permission + approval gating. */
export async function executeTool(
  key: string,
  input: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<{ ok: boolean; data?: unknown; error?: string; code?: string; approvalRequired?: boolean }> {
  const tool = TOOL_MAP.get(key);
  if (!tool) return { ok: false, error: `tool not found: ${key}`, code: "TOOL_NOT_FOUND" };
  if (!ctx.grantedTools.includes(key)) {
    ctx.log(`ابزار ${key} به این ایجنت اعطا نشده است`, { tool: key });
    return { ok: false, error: `tool not granted to agent: ${key}`, code: "TOOL_NOT_GRANTED" };
  }
  if (!ctx.permissions.includes(tool.requiredPermission)) {
    ctx.log(`ایجنت مجوز ${tool.requiredPermission} را ندارد`, { tool: key });
    return { ok: false, error: `permission denied: ${tool.requiredPermission}`, code: "PERMISSION_DENIED" };
  }
  if (ctx.depth > 4) return { ok: false, error: "tool nesting too deep", code: "TOOL_FAILED" };

  try {
    const data = await tool.execute(input ?? {}, ctx);
    ctx.log(`ابزار ${key} اجرا شد`, { tool: key });
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.log(`ابزار ${key} شکست خورد: ${message}`, { tool: key });
    return { ok: false, error: message, code: "TOOL_FAILED" };
  }
}

/** Re-exported for the automation layer (feedback loop). */
export { recordRecommendationFeedback };
