// ============================================================
// HOMEINO — FREE AGENT BLUEPRINT PACK (GitHub-sourced)
//
// A curated set of ready-to-run agents adapted from the best
// free/open-source agent projects on GitHub. Every blueprint maps
// onto Homeino's OWN agent system (declarative handler + granted
// tools + permission gate), so nothing external is required to run:
//
//   • Without any LLM: each agent's `defaultToolPlan` executes its
//     real tools deterministically (free, honest, no invention).
//   • With Ollama (MIT, local models — zero API cost) or any
//     OpenAI-compatible endpoint: the declarative loop gets full
//     reasoning. Dify/Langflow remain available per-agent.
//
// Each blueprint records its source repository + license in
// `config.sourceRepo` / `config.license` — provenance is data, not
// folklore. Blueprints are seeded into the agents table by
// supabase/migrations/202609050002_free_agent_blueprints.sql
// (idempotent, ON CONFLICT DO NOTHING — admin edits are never
// overwritten).
// ============================================================
import type { AgentPermissionKey } from "./permissions";
import type { NewAgentInput } from "./store/types";

export interface AgentBlueprint extends NewAgentInput {
  /** Provenance + runtime hints live in config (mirrored in the SQL seed). */
  config: NewAgentInput["config"] & {
    sourceRepo: string;
    license: string;
    sourceUrl: string;
    adaptationNote: string;
    /** Deterministic tool steps — keeps the agent useful without any LLM. */
    defaultToolPlan?: { tool: string; input?: Record<string, unknown> }[];
  };
}

export const FREE_AGENT_BLUEPRINTS: AgentBlueprint[] = [
  // ------------------------------------------------------------
  // 1. Room style analyzer — adapted from Nutlope/roomGPT (MIT)
  //    roomGPT pioneered "upload a room photo → style + redesign";
  //    here the idea becomes a catalog-grounded agent: it reads the
  //    customer's room/style context, matches REAL products and
  //    remembers the analysis — never inventing products.
  // ------------------------------------------------------------
  {
    key: "room-style-analyzer",
    name: "ایجنت تحلیل سبک فضا",
    description:
      "الهام از roomGPT: تحلیل سبک و رنگ فضای مشتری، تطبیق محصولات واقعی کاتالوگ با همان سبک و ثبت حافظه سلیقه. بدون مدل زبانی هم با برنامه ابزار پیش‌فرض اجرا می‌شود.",
    type: "analyzer",
    status: "active",
    runtime: "local",
    handler: "declarative",
    maxRetries: 2,
    timeoutMs: 25000,
    config: {
      sourceRepo: "Nutlope/roomGPT",
      license: "MIT",
      sourceUrl: "https://github.com/Nutlope/roomGPT",
      adaptationNote: "ایده تحلیل اتاق→سبک به ایجنت کاتالوگ‌محور Homeino تبدیل شد (بدون وابستگی به Replicate)",
      defaultToolPlan: [
        { tool: "getCustomerPreferences" },
        { tool: "searchProducts", input: { limit: 6 } },
      ],
    },
    systemPrompt:
      "تو ایجنت تحلیل سبک فضا در Homeino هستی (الهام‌گرفته از roomGPT). وظیفه: از توضیحات فضا/سلیقه مشتری، سبک و رنگ غالب را استخراج کن و با searchProducts محصولات واقعی هماهنگ پیدا کن. هیچ محصولی از خودت نساز؛ فقط خروجی ابزارها. زبان پاسخ: فارسی.",
    permissions: ["READ_PRODUCTS", "READ_CUSTOMERS", "WRITE_CUSTOMER_MEMORY", "CALL_LLM"] as AgentPermissionKey[],
    tools: ["searchProducts", "getProduct", "getCustomerPreferences", "remember", "llmComplete"],
  },

  // ------------------------------------------------------------
  // 2. Support agent — adapted from danny-avila/LibreChat (MIT)
  //    and the Dify support-bot templates: answer customer questions
  //    from REAL order/profile data, escalate to admin tasks,
  //    never promise anything the data does not show.
  // ------------------------------------------------------------
  {
    key: "support-agent",
    name: "ایجنت پشتیبانی مشتری",
    description:
      "الهام از قالب‌های پشتیبانی LibreChat/Dify: پاسخ به سؤالات سفارش، مرجوعی و موجودی فقط از روی داده واقعی؛ ثبت یادداشت در حافظه مشتری و ارجاع موارد پیچیده به ادمین با createTask.",
    type: "assistant",
    status: "active",
    runtime: "local",
    handler: "declarative",
    maxRetries: 2,
    timeoutMs: 25000,
    config: {
      sourceRepo: "danny-avila/LibreChat",
      license: "MIT",
      sourceUrl: "https://github.com/danny-avila/LibreChat",
      adaptationNote: "الگوی پشتیبانی مبتنی بر ابزار + سیاست «هیچ قولی بدون داده» با گیت مجوز Homeino اجرا می‌شود",
      defaultToolPlan: [
        { tool: "getCustomerPreferences" },
        { tool: "getOrders", input: { limit: 5 } },
      ],
    },
    systemPrompt:
      "تو ایجنت پشتیبانی Homeino هستی. فقط از ابزارهای مجاز (سفارش‌ها، پروفایل، کاتالوگ) استفاده کن و از داده واقعی جواب بده. اگر پاسخ در داده‌ها نبود، صادقانه بگو و با createTask موضوع را برای ادمین ثبت کن. هیچ زمان تحویل یا مبلغی از خودت نساز. زبان پاسخ: فارسی و کوتاه.",
    permissions: ["READ_ORDERS", "READ_CUSTOMERS", "READ_PRODUCTS", "WRITE_CUSTOMER_MEMORY", "WRITE_TASKS", "CALL_LLM"] as AgentPermissionKey[],
    tools: ["getOrders", "getCustomer", "getCustomerPreferences", "searchProducts", "recall", "remember", "createTask", "llmComplete"],
  },

  // ------------------------------------------------------------
  // 3. Voice of customer — adapted from crewAI multi-agent
  //    aggregation patterns (MIT): a scheduled analyst that turns
  //    raw behavioral events into a weekly admin insight task.
  // ------------------------------------------------------------
  {
    key: "voice-of-customer",
    name: "ایجنت صدای مشتری",
    description:
      "الهام از الگوهای چندایجنتی crewAI: هر هفته رویدادهای رفتاری واقعی را جمع‌بندی می‌کند و گزارش بینش (محبوب‌ترین سبک‌ها/گلوگاه‌ها) را به‌صورت وظیفه برای ادمین ثبت می‌کند.",
    type: "analyzer",
    status: "active",
    runtime: "local",
    handler: "declarative",
    maxRetries: 1,
    timeoutMs: 30000,
    schedule: { kind: "weekly", at: "08:00", weekday: 6, timezone: "Asia/Tehran" },
    config: {
      sourceRepo: "crewAIInc/crewAI",
      license: "MIT",
      sourceUrl: "https://github.com/crewAIInc/crewAI",
      adaptationNote: "الگوی نقش‌محوری crewAI به یک ایجنت تحلیلگر زمان‌بندی‌شده با ابزارهای واقعی ساده شد",
      defaultToolPlan: [
        { tool: "getCustomerEvents", input: { limit: 50 } },
        { tool: "getLowStockProducts", input: { threshold: 5 } },
        { tool: "createTask", input: { title: "گزارش هفتگی صدای مشتری", type: "customer_insights", priority: 2 } },
      ],
    },
    systemPrompt:
      "تو ایجنت تحلیل تجربه مشتری Homeino هستی (الهام از crewAI). رویدادهای واقعی را از getCustomerEvents بخوان، الگوهای سبک/دسته/جستجو را خلاصه کن و نتیجه را در createTask با فیلد payload ثبت کن. فقط یافته‌های داده‌محور؛ حدس نزن. زبان گزارش: فارسی.",
    permissions: ["READ_ANALYTICS", "READ_INVENTORY", "WRITE_TASKS", "SEND_NOTIFICATION", "CALL_LLM"] as AgentPermissionKey[],
    tools: ["getCustomerEvents", "getLowStockProducts", "createTask", "sendNotification", "llmComplete"],
  },

  // ------------------------------------------------------------
  // 4. Persian copywriter — adapted from gpt-researcher-style
  //    structured LLM agents (Apache-2.0): drafts Persian product
  //    copy from real product data; output always lands in an
  //    approval task — it can NEVER publish directly.
  // ------------------------------------------------------------
  {
    key: "persian-copywriter",
    name: "ایجنت تولید محتوای فارسی",
    description:
      "الهام از ایجنت‌های تولید محتوای متن‌باز: از مشخصات واقعی محصول، توضیحات و مزایای فارسی پیش‌نویس می‌کند و برای انتشار، وظیفه تأیید فروشنده می‌سازد. بدون LLM صادقانه اعلام می‌کند مدل لازم دارد.",
    type: "generator",
    status: "active",
    runtime: "local",
    handler: "declarative",
    maxRetries: 1,
    timeoutMs: 30000,
    config: {
      sourceRepo: "assafelovic/gpt-researcher",
      license: "Apache-2.0",
      sourceUrl: "https://github.com/assafelovic/gpt-researcher",
      adaptationNote: "الگوی «جمع‌آوری واقعیت → تولید ساختاریافته» با گیت تأیید انسانی Homeino ترکیب شد",
      // No defaultToolPlan BY DESIGN: copywriting needs a model. Without one,
      // the handler answers honestly (llm_not_configured) instead of faking.
    },
    systemPrompt:
      "تو ایجنت کپی‌رایتینگ فارسی Homeino هستی. مشخصات واقعی محصول را با getProduct بخوان و توضیحات فارسی روان (۲ تا ۳ پاراگراف + ۳ مزیت) پیش‌نویس کن. انتشار مستقیم ممنوع است — خروجی را فقط با createTask (type: 'copy_approval') برای تأیید فروشنده بفرست. هیچ ویژگی‌ای که در داده نبود نساز.",
    permissions: ["READ_PRODUCTS", "CALL_LLM", "WRITE_TASKS", "REQUEST_APPROVAL"] as AgentPermissionKey[],
    tools: ["getProduct", "llmComplete", "createTask", "requestApproval"],
  },

  // ------------------------------------------------------------
  // 5. Abandoned-cart recovery — adapted from open e-commerce
  //    automation templates (Activepieces/crewAI, MIT): finds
  //    customers with live carts and queues a gentle reminder —
  //    one notification per run, rate-limited by design.
  // ------------------------------------------------------------
  {
    key: "abandon-cart-recovery",
    name: "ایجنت بازیابی سبد رهاشده",
    description:
      "الهام از قالب‌های اتوماسیون فروشگاهی متن‌باز: سبدهای رهاشده واقعی را می‌خواند، یادآوری محترمانه ثبت می‌کند و وظیفه پیگیری برای ادمین می‌سازد؛ هرگز تخفیف خودکار نمی‌سازد.",
    type: "executor",
    status: "active",
    runtime: "local",
    handler: "declarative",
    maxRetries: 1,
    timeoutMs: 20000,
    schedule: { kind: "daily", at: "19:00", timezone: "Asia/Tehran" },
    config: {
      sourceRepo: "activepieces/activepieces",
      license: "MIT (core)",
      sourceUrl: "https://github.com/activepieces/activepieces",
      adaptationNote: "جریان سبد رهاشده به ایجنت داخلی با اعلان محدودشده تبدیل شد (بدون تخفیف خودکار)",
      defaultToolPlan: [
        { tool: "getCart" },
      ],
    },
    systemPrompt:
      "تو ایجنت بازیابی سبد رهاشده Homeino هستی. با getCart سبد واقعی را بخوان؛ اگر سبدهای رهاشده وجود دارد، برای هر مشتری حداکثر یک sendNotification یادآوری محترمانه (بدون تخفیف، بدون فشار) ثبت کن و جمع‌بندی را با createTask به ادمین بده. اگر سبدی نبود، صادقانه بگو «سبد رهاشده‌ای امروز نیست».",
    permissions: ["READ_ORDERS", "READ_CUSTOMERS", "SEND_NOTIFICATION", "WRITE_TASKS", "CALL_LLM"] as AgentPermissionKey[],
    tools: ["getCart", "getCustomer", "getCustomerPreferences", "sendNotification", "createTask", "llmComplete"],
  },

  // ------------------------------------------------------------
  // 6. Vendor price watcher — adapted from browser-use (MIT).
  //    Skyvern (AGPL-3.0) was reviewed and deliberately NOT adapted:
  //    AGPL copyleft does not fit this proprietary storefront.
  //    Runs ONLY on allowlisted domains, only after human approval,
  //    and results become tasks — prices are never auto-updated.
  // ------------------------------------------------------------
  {
    key: "vendor-price-watcher",
    name: "ایجنت پایش قیمت فروشندگان",
    description:
      "الهام از browser-use: بازدید دوره‌ای فقط از دامنه‌های مجاز فروشندگان، استخراج قیمت/موجودی ساختاریافته و ثبت وظیفه مقایسه برای ادمین. پیش‌فرض غیرفعال؛ نیازمند provider مرورگر و تأیید انسانی برای هر اجرا.",
    type: "browser",
    status: "draft",
    runtime: "local",
    handler: "declarative",
    maxRetries: 1,
    timeoutMs: 60000,
    schedule: { kind: "weekly", at: "06:00", weekday: 3, timezone: "Asia/Tehran" },
    config: {
      sourceRepo: "browser-use/browser-use",
      license: "MIT",
      sourceUrl: "https://github.com/browser-use/browser-use",
      adaptationNote: "الگوی مرورگر ساختاریافته با ابزار browserTask و گیت دامنه مجاز + تأیید اجرا می‌شود؛ Skyvern (AGPL) عمداً کنار گذاشته شد",
      allowedDomains: [],
      maxSteps: 8,
    },
    systemPrompt:
      "تو ایجنت پایش قیمت Homeino هستی (الهام از browser-use). فقط دامنه‌های مجاز config.allowedDomains را با browserTask باز کن، قیمت و موجودی ساختاریافته استخراج کن و مقایسه با کاتالوگ را در createTask ثبت کن. تغییر قیمت مطلقاً ممنوع است (updateProductPrice در اختیار تو نیست). زبان گزارش: فارسی.",
    permissions: ["BROWSER_AUTOMATION", "EXTERNAL_ACTION", "READ_PRODUCTS", "WRITE_TASKS", "REQUEST_APPROVAL"] as AgentPermissionKey[],
    tools: ["browserTask", "httpRequest", "searchProducts", "getProduct", "createTask", "requestApproval"],
  },
];

/** Keys reserved by built-ins — blueprints must never collide. */
export const BLUEPRINT_KEYS = FREE_AGENT_BLUEPRINTS.map((b) => b.key);
