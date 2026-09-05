-- ============================================================
-- HOMEINO — FREE AGENT BLUEPRINT PACK (GitHub-sourced)
--
-- Seeds 6 ready-to-run agents adapted from top open-source agent
-- projects on GitHub. Each blueprint:
--   • runs on Homeino's OWN declarative handler + permission gate
--   • works WITHOUT any API key (config.defaultToolPlan executes
--     real tools deterministically) and gets full LLM reasoning the
--     moment a free local runtime (Ollama) or any provider is set
--   • carries its source repo + license in config (provenance)
--
-- Provenance:
--   room-style-analyzer     ← Nutlope/roomGPT            (MIT)
--   support-agent           ← danny-avila/LibreChat      (MIT)
--   voice-of-customer       ← crewAIInc/crewAI           (MIT)
--   persian-copywriter      ← assafelovic/gpt-researcher (Apache-2.0)
--   abandon-cart-recovery   ← activepieces (core)        (MIT)
--   vendor-price-watcher    ← browser-use/browser-use    (MIT)
--     (Skyvern/AGPL-3.0 was reviewed and deliberately NOT adapted;
--      n8n is fair-code, not OSI open source — excluded.)
--
-- Idempotent: ON CONFLICT DO NOTHING everywhere — admin edits to
-- these agents are never overwritten by re-runs.
-- ============================================================

BEGIN;

INSERT INTO agents (key, name, description, type, status, runtime, handler, system_prompt, is_builtin, max_retries, timeout_ms, config, schedule)
VALUES
  ('room-style-analyzer',
   'ایجنت تحلیل سبک فضا',
   'الهام از roomGPT: تحلیل سبک و رنگ فضای مشتری، تطبیق محصولات واقعی کاتالوگ با همان سبک و ثبت حافظه سلیقه. بدون مدل زبانی هم با برنامه ابزار پیش‌فرض اجرا می‌شود.',
   'analyzer','active','local','declarative',
   'تو ایجنت تحلیل سبک فضا در Homeino هستی (الهام‌گرفته از roomGPT). وظیفه: از توضیحات فضا/سلیقه مشتری، سبک و رنگ غالب را استخراج کن و با searchProducts محصولات واقعی هماهنگ پیدا کن. هیچ محصولی از خودت نساز؛ فقط خروجی ابزارها. زبان پاسخ: فارسی.',
   false, 2, 25000,
   '{"sourceRepo":"Nutlope/roomGPT","license":"MIT","sourceUrl":"https://github.com/Nutlope/roomGPT","adaptationNote":"ایده تحلیل اتاق→سبک به ایجنت کاتالوگ‌محور Homeino تبدیل شد (بدون وابستگی به Replicate)","defaultToolPlan":[{"tool":"getCustomerPreferences"},{"tool":"searchProducts","input":{"limit":6}}]}'::jsonb,
   NULL::jsonb),

  ('support-agent',
   'ایجنت پشتیبانی مشتری',
   'الهام از قالب‌های پشتیبانی LibreChat/Dify: پاسخ به سؤالات سفارش، مرجوعی و موجودی فقط از روی داده واقعی؛ ثبت یادداشت در حافظه مشتری و ارجاع موارد پیچیده به ادمین با createTask.',
   'assistant','active','local','declarative',
   'تو ایجنت پشتیبانی Homeino هستی. فقط از ابزارهای مجاز (سفارش‌ها، پروفایل، کاتالوگ) استفاده کن و از داده واقعی جواب بده. اگر پاسخ در داده‌ها نبود، صادقانه بگو و با createTask موضوع را برای ادمین ثبت کن. هیچ زمان تحویل یا مبلغی از خودت نساز. زبان پاسخ: فارسی و کوتاه.',
   false, 2, 25000,
   '{"sourceRepo":"danny-avila/LibreChat","license":"MIT","sourceUrl":"https://github.com/danny-avila/LibreChat","adaptationNote":"الگوی پشتیبانی مبتنی بر ابزار + سیاست «هیچ قولی بدون داده» با گیت مجوز Homeino اجرا می‌شود","defaultToolPlan":[{"tool":"getCustomerPreferences"},{"tool":"getOrders","input":{"limit":5}}]}'::jsonb,
   NULL::jsonb),

  ('voice-of-customer',
   'ایجنت صدای مشتری',
   'الهام از الگوهای چندایجنتی crewAI: هر هفته رویدادهای رفتاری واقعی را جمع‌بندی می‌کند و گزارش بینش (محبوب‌ترین سبک‌ها/گلوگاه‌ها) را به‌صورت وظیفه برای ادمین ثبت می‌کند.',
   'analyzer','active','local','declarative',
   'تو ایجنت تحلیل تجربه مشتری Homeino هستی (الهام از crewAI). رویدادهای واقعی را از getCustomerEvents بخوان، الگوهای سبک/دسته/جستجو را خلاصه کن و نتیجه را در createTask با فیلد payload ثبت کن. فقط یافته‌های داده‌محور؛ حدس نزن. زبان گزارش: فارسی.',
   false, 1, 30000,
   '{"sourceRepo":"crewAIInc/crewAI","license":"MIT","sourceUrl":"https://github.com/crewAIInc/crewAI","adaptationNote":"الگوی نقش‌محوری crewAI به یک ایجنت تحلیلگر زمان‌بندی‌شده با ابزارهای واقعی ساده شد","defaultToolPlan":[{"tool":"getCustomerEvents","input":{"limit":50}},{"tool":"getLowStockProducts","input":{"threshold":5}},{"tool":"createTask","input":{"title":"گزارش هفتگی صدای مشتری","type":"customer_insights","priority":2}}]}'::jsonb,
   '{"kind":"weekly","at":"08:00","weekday":6,"timezone":"Asia/Tehran"}'::jsonb),

  ('persian-copywriter',
   'ایجنت تولید محتوای فارسی',
   'الهام از ایجنت‌های تولید محتوای متن‌باز: از مشخصات واقعی محصول، توضیحات و مزایای فارسی پیش‌نویس می‌کند و برای انتشار، وظیفه تأیید فروشنده می‌سازد. بدون LLM صادقانه اعلام می‌کند مدل لازم دارد.',
   'generator','active','local','declarative',
   'تو ایجنت کپی‌رایتینگ فارسی Homeino هستی. مشخصات واقعی محصول را با getProduct بخوان و توضیحات فارسی روان (۲ تا ۳ پاراگراف + ۳ مزیت) پیش‌نویس کن. انتشار مستقیم ممنوع است — خروجی را فقط با createTask (type: ''copy_approval'') برای تأیید فروشنده بفرست. هیچ ویژگی‌ای که در داده نبود نساز.',
   false, 1, 30000,
   '{"sourceRepo":"assafelovic/gpt-researcher","license":"Apache-2.0","sourceUrl":"https://github.com/assafelovic/gpt-researcher","adaptationNote":"الگوی «جمع‌آوری واقعیت → تولید ساختاریافته» با گیت تأیید انسانی Homeino ترکیب شد"}'::jsonb,
   NULL::jsonb),

  ('abandon-cart-recovery',
   'ایجنت بازیابی سبد رهاشده',
   'الهام از قالب‌های اتوماسیون فروشگاهی متن‌باز: سبدهای رهاشده واقعی را می‌خواند، یادآوری محترمانه ثبت می‌کند و وظیفه پیگیری برای ادمین می‌سازد؛ هرگز تخفیف خودکار نمی‌سازد.',
   'executor','active','local','declarative',
   'تو ایجنت بازیابی سبد رهاشده Homeino هستی. با getCart سبد واقعی را بخوان؛ اگر سبدهای رهاشده وجود دارد، برای هر مشتری حداکثر یک sendNotification یادآوری محترمانه (بدون تخفیف، بدون فشار) ثبت کن و جمع‌بندی را با createTask به ادمین بده. اگر سبدی نبود، صادقانه بگو «سبد رهاشده‌ای امروز نیست».',
   false, 1, 20000,
   '{"sourceRepo":"activepieces/activepieces","license":"MIT (core)","sourceUrl":"https://github.com/activepieces/activepieces","adaptationNote":"جریان سبد رهاشده به ایجنت داخلی با اعلان محدودشده تبدیل شد (بدون تخفیف خودکار)","defaultToolPlan":[{"tool":"getCart"}]}'::jsonb,
   '{"kind":"daily","at":"19:00","timezone":"Asia/Tehran"}'::jsonb),

  ('vendor-price-watcher',
   'ایجنت پایش قیمت فروشندگان',
   'الهام از browser-use: بازدید دوره‌ای فقط از دامنه‌های مجاز فروشندگان، استخراج قیمت/موجودی ساختاریافته و ثبت وظیفه مقایسه برای ادمین. پیش‌فرض غیرفعال؛ نیازمند provider مرورگر و تأیید انسانی برای هر اجرا.',
   'browser','draft','local','declarative',
   'تو ایجنت پایش قیمت Homeino هستی (الهام از browser-use). فقط دامنه‌های مجاز config.allowedDomains را با browserTask باز کن، قیمت و موجودی ساختاریافته استخراج کن و مقایسه با کاتالوگ را در createTask ثبت کن. تغییر قیمت مطلقاً ممنوع است (updateProductPrice در اختیار تو نیست). زبان گزارش: فارسی.',
   false, 1, 60000,
   '{"sourceRepo":"browser-use/browser-use","license":"MIT","sourceUrl":"https://github.com/browser-use/browser-use","adaptationNote":"الگوی مرورگر ساختاریافته با ابزار browserTask و گیت دامنه مجاز + تأیید اجرا می‌شود؛ Skyvern (AGPL) عمداً کنار گذاشته شد","allowedDomains":[],"maxSteps":8}'::jsonb,
   '{"kind":"weekly","at":"06:00","weekday":3,"timezone":"Asia/Tehran"}'::jsonb)

ON CONFLICT (key) DO NOTHING;

-- ---- permissions (mirror of blueprints.ts) ----
INSERT INTO agent_permissions (agent_id, permission)
SELECT a.id, p.perm
FROM agents a
CROSS JOIN (VALUES
  ('room-style-analyzer','READ_PRODUCTS'),
  ('room-style-analyzer','READ_CUSTOMERS'),
  ('room-style-analyzer','WRITE_CUSTOMER_MEMORY'),
  ('room-style-analyzer','CALL_LLM'),
  ('support-agent','READ_ORDERS'),
  ('support-agent','READ_CUSTOMERS'),
  ('support-agent','READ_PRODUCTS'),
  ('support-agent','WRITE_CUSTOMER_MEMORY'),
  ('support-agent','WRITE_TASKS'),
  ('support-agent','CALL_LLM'),
  ('voice-of-customer','READ_ANALYTICS'),
  ('voice-of-customer','READ_INVENTORY'),
  ('voice-of-customer','WRITE_TASKS'),
  ('voice-of-customer','SEND_NOTIFICATION'),
  ('voice-of-customer','CALL_LLM'),
  ('persian-copywriter','READ_PRODUCTS'),
  ('persian-copywriter','CALL_LLM'),
  ('persian-copywriter','WRITE_TASKS'),
  ('persian-copywriter','REQUEST_APPROVAL'),
  ('abandon-cart-recovery','READ_ORDERS'),
  ('abandon-cart-recovery','READ_CUSTOMERS'),
  ('abandon-cart-recovery','SEND_NOTIFICATION'),
  ('abandon-cart-recovery','WRITE_TASKS'),
  ('abandon-cart-recovery','CALL_LLM'),
  ('vendor-price-watcher','BROWSER_AUTOMATION'),
  ('vendor-price-watcher','EXTERNAL_ACTION'),
  ('vendor-price-watcher','READ_PRODUCTS'),
  ('vendor-price-watcher','WRITE_TASKS'),
  ('vendor-price-watcher','REQUEST_APPROVAL')
) AS p(agent_key, perm)
WHERE a.key = p.agent_key
ON CONFLICT (agent_id, permission) DO NOTHING;

-- ---- tool grants (all keys exist in agent_tools since 202609040001) ----
INSERT INTO agent_tool_grants (agent_id, tool_key)
SELECT a.id, g.tool_key
FROM agents a
CROSS JOIN (VALUES
  ('room-style-analyzer','searchProducts'),
  ('room-style-analyzer','getProduct'),
  ('room-style-analyzer','getCustomerPreferences'),
  ('room-style-analyzer','remember'),
  ('room-style-analyzer','llmComplete'),
  ('support-agent','getOrders'),
  ('support-agent','getCustomer'),
  ('support-agent','getCustomerPreferences'),
  ('support-agent','searchProducts'),
  ('support-agent','recall'),
  ('support-agent','remember'),
  ('support-agent','createTask'),
  ('support-agent','llmComplete'),
  ('voice-of-customer','getCustomerEvents'),
  ('voice-of-customer','getLowStockProducts'),
  ('voice-of-customer','createTask'),
  ('voice-of-customer','sendNotification'),
  ('voice-of-customer','llmComplete'),
  ('persian-copywriter','getProduct'),
  ('persian-copywriter','llmComplete'),
  ('persian-copywriter','createTask'),
  ('persian-copywriter','requestApproval'),
  ('abandon-cart-recovery','getCart'),
  ('abandon-cart-recovery','getCustomer'),
  ('abandon-cart-recovery','getCustomerPreferences'),
  ('abandon-cart-recovery','sendNotification'),
  ('abandon-cart-recovery','createTask'),
  ('abandon-cart-recovery','llmComplete'),
  ('vendor-price-watcher','browserTask'),
  ('vendor-price-watcher','httpRequest'),
  ('vendor-price-watcher','searchProducts'),
  ('vendor-price-watcher','getProduct'),
  ('vendor-price-watcher','createTask'),
  ('vendor-price-watcher','requestApproval')
) AS g(agent_key, tool_key)
WHERE a.key = g.agent_key
ON CONFLICT (agent_id, tool_key) DO NOTHING;

COMMIT;
