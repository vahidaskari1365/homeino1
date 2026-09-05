// ============================================================
// HOMEINO — BUILT-IN AGENT / TOOL / WORKFLOW DEFINITIONS
//
// Single source of truth for the seeded orchestrator. The same definitions are
// inserted by supabase/migrations/202609040001_agentic_core.sql (database mode)
// and by the store bootstrap (in-process mode), so both environments behave
// identically.
//
// Admins can add more agents/workflows at runtime — nothing here is required to
// be hard-coded into the running system.
// ============================================================
import type { AgentPermissionKey } from "./permissions";
import type { ToolRecord, IntegrationRecord, BudgetRecord } from "./store/types";
import type { NewAgentInput, NewWorkflowInput } from "./store/types";

// ------------------------------------------------------------
// Tool registry (metadata). Executable implementations: tools.ts
// ------------------------------------------------------------
export const BUILTIN_TOOLS: ToolRecord[] = [
  { key: "getProduct", name: "دریافت محصول", description: "خواندن یک محصول واقعی از کاتالوگ با id یا SKU", category: "catalog", requiredPermission: "READ_PRODUCTS", requiresApproval: false, isDestructive: false, inputSchema: { productId: "string?", sku: "string?", slug: "string?" }, isActive: true, isBuiltin: true },
  { key: "searchProducts", name: "جستجوی محصول", description: "جستجوی واقعی در کاتالوگ با فیلترهای سبک/رنگ/قیمت/دسته", category: "catalog", requiredPermission: "READ_PRODUCTS", requiresApproval: false, isDestructive: false, inputSchema: { q: "string?", categorySlug: "string?", styleSlug: "string?", minPrice: "number?", maxPrice: "number?", limit: "number?" }, isActive: true, isBuiltin: true },
  { key: "listProducts", name: "فهرست محصولات", description: "فهرست گرفتن از محصولات فعال برای رتبه‌بندی", category: "catalog", requiredPermission: "READ_PRODUCTS", requiresApproval: false, isDestructive: false, inputSchema: { limit: "number?" }, isActive: true, isBuiltin: true },
  { key: "matchProductsBySku", name: "تطبیق SKU", description: "یافتن محصول واقعی با SKU — بدون ساخت SKU جعلی", category: "catalog", requiredPermission: "READ_PRODUCTS", requiresApproval: false, isDestructive: false, inputSchema: { sku: "string" }, isActive: true, isBuiltin: true },
  { key: "getInventory", name: "موجودی", description: "خواندن موجودی یک محصول", category: "catalog", requiredPermission: "READ_INVENTORY", requiresApproval: false, isDestructive: false, inputSchema: { productId: "string" }, isActive: true, isBuiltin: true },
  { key: "getLowStockProducts", name: "محصولات کم‌موجود", description: "کوئری موجودی زیر آستانه", category: "catalog", requiredPermission: "READ_INVENTORY", requiresApproval: false, isDestructive: false, inputSchema: { threshold: "number?" }, isActive: true, isBuiltin: true },
  { key: "getCustomer", name: "پروفایل مشتری", description: "خواندن کاربر و پروفایل محاسبه‌شده او", category: "customer", requiredPermission: "READ_CUSTOMERS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string" }, isActive: true, isBuiltin: true },
  { key: "getCustomerPreferences", name: "ترجیحات مشتری", description: "خواندن ترجیحات استخراج‌شده از رفتار واقعی", category: "customer", requiredPermission: "READ_CUSTOMERS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?" }, isActive: true, isBuiltin: true },
  { key: "getCustomerEvents", name: "رویدادهای مشتری", description: "خواندن رویدادهای رفتاری ثبت‌شده", category: "analytics", requiredPermission: "READ_ANALYTICS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?", sessionId: "string?", limit: "number?" }, isActive: true, isBuiltin: true },
  { key: "getOrders", name: "سفارش‌ها", description: "خواندن سفارش‌های مشتری", category: "commerce", requiredPermission: "READ_ORDERS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?", limit: "number?" }, isActive: true, isBuiltin: true },
  { key: "getWishlist", name: "علاقه‌مندی‌ها", description: "خواندن علاقه‌مندی‌های مشتری", category: "commerce", requiredPermission: "READ_CUSTOMERS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?", sessionId: "string?" }, isActive: true, isBuiltin: true },
  { key: "getCart", name: "سبد خرید", description: "خواندن سبد خرید مشتری", category: "commerce", requiredPermission: "READ_ORDERS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?", sessionId: "string?" }, isActive: true, isBuiltin: true },
  { key: "updateCustomerProfile", name: "به‌روزرسانی پروفایل مشتری", description: "نوشتن پروفایل محاسبه‌شده توسط ایجنت", category: "customer", requiredPermission: "WRITE_CUSTOMER_PROFILE", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string", profile: "object" }, isActive: true, isBuiltin: true },
  { key: "remember", name: "ثبت حافظه", description: "افزودن/به‌روزرسانی یک رکورد حافظه بلندمدت مشتری", category: "memory", requiredPermission: "WRITE_CUSTOMER_MEMORY", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string", kind: "string", key: "string", value: "object?" }, isActive: true, isBuiltin: true },
  { key: "recall", name: "بازیابی حافظه", description: "جستجوی حافظه مشتری", category: "memory", requiredPermission: "READ_CUSTOMERS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string", query: "string?", kind: "string?", limit: "number?" }, isActive: true, isBuiltin: true },
  { key: "createRecommendation", name: "ساخت پیشنهاد", description: "ذخیره پیشنهاد محصولات واقعی برای مشتری", category: "recommendation", requiredPermission: "WRITE_RECOMMENDATIONS", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?", scenario: "string", items: "array" }, isActive: true, isBuiltin: true },
  { key: "createTask", name: "ساخت وظیفه", description: "افزودن وظیفه به صف وظایف ادمین/فروشنده", category: "automation", requiredPermission: "WRITE_TASKS", requiresApproval: false, isDestructive: false, inputSchema: { title: "string", type: "string?", payload: "object?" }, isActive: true, isBuiltin: true },
  { key: "sendNotification", name: "ارسال اعلان", description: "ثبت اعلان داخلی برای کاربر یا ادمین", category: "automation", requiredPermission: "SEND_NOTIFICATION", requiresApproval: false, isDestructive: false, inputSchema: { userId: "string?", audience: "string?", type: "string", title: "string", body: "string?" }, isActive: true, isBuiltin: true },
  { key: "requestApproval", name: "درخواست تأیید انسانی", description: "ثبت درخواست تأیید برای اقدامات پرخطر", category: "automation", requiredPermission: "REQUEST_APPROVAL", requiresApproval: false, isDestructive: false, inputSchema: { action: "string", reason: "string?", risk: "string?" }, isActive: true, isBuiltin: true },
  { key: "llmComplete", name: "فراخوانی LLM", description: "یک فراخوانی ساختاریافته به لایه LLM (پروایدر قابل تعویض)", category: "ai", requiredPermission: "CALL_LLM", requiresApproval: false, isDestructive: false, inputSchema: { system: "string?", prompt: "string", json: "boolean?" }, isActive: true, isBuiltin: true },
  { key: "httpRequest", name: "درخواست HTTP", description: "فقط به دامنه‌های مجاز (allowlist) — نیازمند تأیید", category: "integration", requiredPermission: "EXTERNAL_ACTION", requiresApproval: true, isDestructive: false, inputSchema: { url: "string", method: "string?", body: "object?" }, isActive: true, isBuiltin: true },
  { key: "browserTask", name: "وظیفه مرورگر", description: "باز کردن دامنه مجاز و استخراج داده ساختاریافته — نیازمند تأیید", category: "integration", requiredPermission: "BROWSER_AUTOMATION", requiresApproval: true, isDestructive: false, inputSchema: { url: "string", instruction: "string", action: "string?" }, isActive: true, isBuiltin: true },
  { key: "updateProductPrice", name: "تغییر قیمت محصول", description: "تغییر قیمت — همیشه نیازمند تأیید انسانی", category: "danger", requiredPermission: "WRITE_PRODUCTS", requiresApproval: true, isDestructive: true, inputSchema: { productId: "string", price: "number" }, isActive: true, isBuiltin: true },
  { key: "cancelOrder", name: "لغو سفارش", description: "لغو سفارش — همیشه نیازمند تأیید انسانی", category: "danger", requiredPermission: "ORDER_CANCEL", requiresApproval: true, isDestructive: true, inputSchema: { orderId: "string" }, isActive: true, isBuiltin: true },
  { key: "refundPayment", name: "بازگشت وجه", description: "بازگشت وجه — همیشه نیازمند تأیید انسانی", category: "danger", requiredPermission: "REFUND", requiresApproval: true, isDestructive: true, inputSchema: { orderId: "string", amount: "number" }, isActive: true, isBuiltin: true },
  { key: "deleteEntity", name: "حذف موجودیت", description: "هر حذف داده — همیشه نیازمند تأیید انسانی", category: "danger", requiredPermission: "DATABASE_DESTRUCTIVE_WRITE", requiresApproval: true, isDestructive: true, inputSchema: { entity: "string", id: "string" }, isActive: true, isBuiltin: true },
];

export const TOOL_KEYS = BUILTIN_TOOLS.map((t) => t.key);

// ------------------------------------------------------------
// Built-in agents
// ------------------------------------------------------------
interface BuiltinAgent extends NewAgentInput {
  isBuiltin: true;
}

export const BUILTIN_AGENTS: BuiltinAgent[] = [
  {
    isBuiltin: true,
    key: "customer-intelligence",
    name: "ایجنت هوش مشتری",
    description:
      "تحلیل رفتار واقعی مشتری (بازدید محصول، جستجو، علاقه‌مندی، سبد، خرید) و ساخت CustomerProfile + حافظه بلندمدت.",
    type: "analyzer",
    status: "active",
    runtime: "local",
    handler: "customerIntelligence",
    maxRetries: 2,
    timeoutMs: 20000,
    config: { minEvents: 3, windowHours: 24 * 30 },
    permissions: [
      "READ_CUSTOMERS",
      "READ_ANALYTICS",
      "READ_PRODUCTS",
      "READ_ORDERS",
      "WRITE_CUSTOMER_PROFILE",
      "WRITE_CUSTOMER_MEMORY",
    ] as AgentPermissionKey[],
    tools: [
      "getCustomerEvents",
      "getCustomer",
      "getCustomerPreferences",
      "getOrders",
      "getWishlist",
      "getCart",
      "listProducts",
      "getProduct", // aligned with SQL seed (idempotent migration 202609050001)
      "updateCustomerProfile",
      "remember",
    ],
  },
  {
    isBuiltin: true,
    key: "recommendation",
    name: "ایجنت پیشنهاد",
    description:
      "پیشنهاد محصولات واقعی از کاتالوگ با رتبه‌بندی چندعاملی (سبک، دسته، رنگ، قیمت، اتاق، رفتار، محبوبیت، موجودی، کیفیت فروشنده).",
    type: "generator",
    status: "active",
    runtime: "local",
    handler: "recommendation",
    maxRetries: 2,
    timeoutMs: 25000,
    config: { limit: 12, scenarios: ["home", "product_detail", "wishlist", "cart", "account", "search", "ai_designer", "store"] },
    permissions: [
      "READ_PRODUCTS",
      "READ_CUSTOMERS",
      "READ_ANALYTICS",
      "READ_INVENTORY",
      "WRITE_RECOMMENDATIONS",
      "CALL_LLM",
    ] as AgentPermissionKey[],
    tools: [
      "searchProducts",
      "listProducts",
      "getProduct",
      "getCustomerPreferences",
      "getInventory",
      "recall",
      "createRecommendation",
      "llmComplete",
    ],
  },
  {
    isBuiltin: true,
    key: "shopping-assistant",
    name: "دستیار خرید هوشمند",
    description:
      "فهم قصد خرید از متن فارسی، استخراج دسته/سبک/رنگ/بودجه/اتاق، کوئری کاتالوگ واقعی و رتبه‌بندی — بدون ساخت محصول یا قیمت.",
    type: "assistant",
    status: "active",
    runtime: "local",
    handler: "shoppingAssistant",
    maxRetries: 2,
    timeoutMs: 25000,
    config: { maxResults: 6 },
    permissions: [
      "READ_PRODUCTS",
      "READ_CUSTOMERS",
      "READ_INVENTORY",
      "WRITE_CUSTOMER_MEMORY",
      "CALL_LLM",
    ] as AgentPermissionKey[],
    tools: ["searchProducts", "getProduct", "matchProductsBySku", "getCustomerPreferences", "getInventory", "llmComplete", "remember"],
  },
  {
    isBuiltin: true,
    key: "inventory",
    name: "ایجنت موجودی",
    description: "پایش موجودی کم/اتمام، ساخت وظیفه برای ادمین و فروشنده و ثبت نتیجه در لاگ اجرا.",
    type: "executor",
    status: "active",
    runtime: "local",
    handler: "inventory",
    maxRetries: 1,
    timeoutMs: 20000,
    schedule: { kind: "daily", at: "09:00" },
    config: { threshold: 5, notifyVendor: true, notifyAdmin: true },
    permissions: ["READ_PRODUCTS", "READ_INVENTORY", "READ_VENDORS", "WRITE_TASKS", "SEND_NOTIFICATION"] as AgentPermissionKey[],
    // listProducts removed: the handler only queries low stock + tasks/notices
    // (matches the SQL seed exactly).
    tools: ["getLowStockProducts", "getInventory", "createTask", "sendNotification"],
  },
  {
    isBuiltin: true,
    key: "designer",
    name: "ایجنت طراحی AI",
    description:
      "پل بین هومینو استودیو و سیستم ایجنتی: حفظ محصول واقعی (SKU)، تطبیق محصولات کاتالوگ با طرح تولیدشده و ذخیره پیشنهادها.",
    type: "generator",
    status: "active",
    runtime: "local",
    handler: "designer",
    maxRetries: 2,
    timeoutMs: 45000,
    config: { preserveSkuProduct: true },
    permissions: ["READ_PRODUCTS", "READ_CUSTOMERS", "WRITE_RECOMMENDATIONS", "WRITE_CUSTOMER_MEMORY"] as AgentPermissionKey[],
    tools: ["getProduct", "matchProductsBySku", "searchProducts", "getCustomerPreferences", "createRecommendation", "remember"],
    // CALL_LLM / llmComplete were removed: the designer never calls the LLM
    // (dead grant) — remember + WRITE_CUSTOMER_MEMORY are what it really uses.
  },
  {
    isBuiltin: true,
    key: "browser",
    name: "ایجنت مرورگر",
    description:
      "اجرای وظایف مرورگری فقط روی دامنه‌های مجاز (Browser Use / Stagehand). به‌صورت پیش‌فرض غیرفعال و نیازمند تأیید انسانی.",
    type: "browser",
    status: "draft",
    runtime: "local",
    handler: "browser",
    maxRetries: 1,
    timeoutMs: 60000,
    config: { allowedDomains: [], maxSteps: 8, provider: "auto" },
    permissions: ["BROWSER_AUTOMATION", "EXTERNAL_ACTION", "READ_PRODUCTS"] as AgentPermissionKey[],
    tools: ["browserTask", "httpRequest"],
  },
];

// ------------------------------------------------------------
// Built-in workflows — the three real end-to-end flows
// ------------------------------------------------------------
export const BUILTIN_WORKFLOWS: (NewWorkflowInput & { isBuiltin: true })[] = [
  {
    isBuiltin: true,
    key: "customer-view-intelligence",
    name: "هوش مشتری از بازدید محصولات",
    description:
      "WHEN مشتری محصولات را می‌بیند → پروفایل او به‌روز می‌شود → پیشنهادهای واقعی از کاتالوگ ساخته و ذخیره می‌شود.",
    status: "active",
    triggerKind: "event",
    trigger: { eventTypes: ["product_view", "product_click", "product_search", "style_view"], minEvents: 3, windowMinutes: 1440 },
    config: { cooldownMinutes: 15 },
    nodes: [
      { key: "n1", type: "trigger", label: "روی بازدید محصول", config: { eventTypes: ["product_view", "product_click", "product_search", "style_view"] } },
      { key: "n2", type: "condition", label: "حداقل ۳ رویداد در ۲۴ ساعت", config: { expression: "eventCount >= 3" } },
      { key: "n3", type: "agent", label: "تحلیل رفتار مشتری", agentKey: "customer-intelligence", config: { outputKey: "profile" } },
      { key: "n4", type: "agent", label: "ساخت پیشنهاد محصولات واقعی", agentKey: "recommendation", config: { inputFrom: "profile", scenario: "home", outputKey: "recommendations" } },
      { key: "n5", type: "db_update", label: "ذخیره پیشنهادها", config: { table: "recommendations", from: "recommendations" } },
      { key: "n6", type: "end", label: "پایان", config: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "true" },
      { from: "n2", to: "n6", label: "false" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
  },
  {
    isBuiltin: true,
    key: "wishlist-similar-products",
    name: "پیشنهاد مشابه از علاقه‌مندی",
    description:
      "WHEN محصولی به علاقه‌مندی اضافه می‌شود → تحلیل ترجیح → یافتن محصولات مشابه واقعی → ذخیره لیست پیشنهاد.",
    status: "active",
    triggerKind: "event",
    trigger: { eventTypes: ["wishlist_add", "product_favorited"], minEvents: 1 },
    config: { cooldownMinutes: 5 },
    nodes: [
      { key: "n1", type: "trigger", label: "روی افزودن به علاقه‌مندی", config: { eventTypes: ["wishlist_add", "product_favorited"] } },
      { key: "n2", type: "db_query", label: "خواندن محصول واقعی", config: { query: "product", from: "event.entityId", outputKey: "product" } },
      { key: "n3", type: "agent", label: "تحلیل ترجیح و به‌روزرسانی حافظه", agentKey: "customer-intelligence", config: { inputFrom: "product", outputKey: "profile" } },
      { key: "n4", type: "recommendation", label: "یافتن محصولات مشابه واقعی", agentKey: "recommendation", config: { scenario: "wishlist", seedFrom: "product", outputKey: "recommendations" } },
      { key: "n5", type: "db_update", label: "ذخیره لیست پیشنهاد", config: { table: "recommendations", from: "recommendations" } },
      { key: "n6", type: "end", label: "پایان", config: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
    ],
  },
  {
    isBuiltin: true,
    key: "low-stock-audit",
    name: "ممیزی موجودی کم",
    description:
      "اجرای دستی یا زمان‌بندی‌شده → ایجنت موجودی → کوئری محصولات کم‌موجود → ساخت وظیفه ادمین + اعلان → ثبت نتیجه.",
    status: "active",
    triggerKind: "manual",
    trigger: {},
    schedule: { kind: "daily", at: "09:00" },
    config: { threshold: 5 },
    nodes: [
      { key: "n1", type: "trigger", label: "اجرای دستی/زمان‌بندی", config: { kind: "manual" } },
      { key: "n2", type: "schedule", label: "هر روز ساعت ۰۹:۰۰", config: { kind: "daily", at: "09:00" } },
      { key: "n3", type: "agent", label: "ممیزی موجودی", agentKey: "inventory", config: { threshold: 5, outputKey: "lowStock" } },
      { key: "n4", type: "condition", label: "اگر محصول کم‌موجود وجود دارد", config: { expression: "lowStock.count > 0" } },
      { key: "n5", type: "notification", label: "اعلان به ادمین", config: { audience: "admin", title: "محصولات کم‌موجود", from: "lowStock" } },
      { key: "n6", type: "end", label: "پایان", config: {} },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5", label: "true" },
      { from: "n4", to: "n6", label: "false" },
      { from: "n5", to: "n6" },
    ],
  },
];

// ------------------------------------------------------------
// External integrations (config only — secrets stay in env)
// ------------------------------------------------------------
export const DEFAULT_INTEGRATIONS: IntegrationRecord[] = [
  { id: "dify", provider: "dify", label: "Dify — Workflow + Agent Platform", baseUrl: process.env.DIFY_API_BASE_URL ?? "https://api.dify.ai/v1", secretEnvVar: "DIFY_API_KEY", authScheme: "bearer", config: { docs: "https://docs.dify.ai", runPath: "/workflows/run", chatPath: "/chat-messages" }, capabilities: ["workflow", "agent", "tools"], isActive: Boolean(process.env.DIFY_API_KEY), healthStatus: "unknown" },
  { id: "langflow", provider: "langflow", label: "Langflow — Agent/Workflow Builder", baseUrl: process.env.LANGFLOW_BASE_URL ?? null, secretEnvVar: "LANGFLOW_API_KEY", authScheme: "x-api-key", config: { docs: "https://docs.langflow.org", runPath: "/api/v1/run" }, capabilities: ["workflow", "agent"], isActive: Boolean(process.env.LANGFLOW_API_KEY && process.env.LANGFLOW_BASE_URL), healthStatus: "unknown" },
  { id: "ollama", provider: "ollama", label: "Ollama — مدل‌های Open Source محلی", baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434", secretEnvVar: null, authScheme: "none", config: { chatPath: "/api/chat", embedPath: "/api/embed", tagsPath: "/api/tags", model: process.env.OLLAMA_MODEL ?? "llama3.1" }, capabilities: ["llm", "embeddings"], isActive: Boolean(process.env.OLLAMA_BASE_URL), healthStatus: "unknown" },
  { id: "mem0", provider: "mem0", label: "Mem0 — حافظه بلندمدت ایجنت", baseUrl: process.env.MEM0_BASE_URL ?? "https://api.mem0.ai", secretEnvVar: "MEM0_API_KEY", authScheme: "token", config: { addPath: "/v2/memories/", searchPath: "/v2/memories/search/", listPath: "/v1/memories/" }, capabilities: ["memory"], isActive: Boolean(process.env.MEM0_API_KEY), healthStatus: "unknown" },
  { id: "browser_use", provider: "browser_use", label: "Browser Use — ایجنت مرورگر", baseUrl: process.env.BROWSER_USE_API_BASE_URL ?? "https://api.browser-use.com", secretEnvVar: "BROWSER_USE_API_KEY", authScheme: "x-api-key", config: { runPath: "/v1/tasks/run", maxSteps: 8, allowedDomains: [] }, capabilities: ["browser"], isActive: Boolean(process.env.BROWSER_USE_API_KEY), healthStatus: "unknown" },
  { id: "stagehand", provider: "stagehand", label: "Stagehand — اتوماسیون مرورگر (Playwright)", baseUrl: process.env.STAGEHAND_API_BASE_URL ?? null, secretEnvVar: "BROWSERBASE_API_KEY", authScheme: "bearer", config: { primitives: ["act", "extract", "observe"], docs: "https://github.com/browserbase/stagehand" }, capabilities: ["browser"], isActive: Boolean(process.env.STAGEHAND_API_BASE_URL), healthStatus: "unknown" },
];

export const DEFAULT_BUDGETS: BudgetRecord[] = [
  { id: "global", scope: "global", scopeKey: null, dailyLimitMicro: 0, monthlyLimitMicro: 0, perRunLimitMicro: 0, maxRunsPerDay: 0, isActive: true },
];

/** Node types the builder may use — mirrors workflow_node_type in SQL. */
export const WORKFLOW_NODE_TYPES = [
  "trigger",
  "condition",
  "agent",
  "db_query",
  "db_update",
  "recommendation",
  "notification",
  "delay",
  "schedule",
  "human_approval",
  "http_request",
  "browser_task",
  "end",
] as const;

export const NODE_TYPE_LABELS: Record<(typeof WORKFLOW_NODE_TYPES)[number], string> = {
  trigger: "تریگر",
  condition: "شرط",
  agent: "ایجنت هومینو استودیو",
  db_query: "کوئری دیتابیس",
  db_update: "به‌روزرسانی دیتابیس",
  recommendation: "پیشنهاد محصول",
  notification: "اعلان",
  delay: "تأخیر",
  schedule: "زمان‌بندی",
  human_approval: "تأیید انسانی",
  http_request: "درخواست HTTP",
  browser_task: "وظیفه مرورگر",
  end: "پایان",
};
