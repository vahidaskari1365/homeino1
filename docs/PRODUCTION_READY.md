# Homeino — وضعیت واقعی آمادگی برای لانچ

_Snapshot: quality-hardening pass (امنیت، پایداری بیلد، performance، نجات سشن‌های AI، تست منطق خالص)._

این سند ادعاهای قبلی را اصلاح می‌کند. سایت **دموی سرمایه‌گذار** است و در حالت mock بدون `DATABASE_URL` بیلد و اجرا می‌شود.

---

## وضعیت فعلی (صادقانه)

| حوزه | واقعیت |
|---|---|
| UI / دمو | صفحات مارکت‌پلیس با داده mock در `src/data/*` رندر می‌شوند. ظاهر دمو نباید در این پاس عوض شود. |
| تصاویر | `SmartImage` از `<img>` استفاده می‌کند، **نه** `next/image`. بهینه‌سازی خودکار AVIF/WebP روی این مسیر فعال نیست. |
| Hero | ویدیو `preload="metadata"` + پوستر استخراج‌شده از فریم ویدیو (`/video/hero-poster.jpg`). H1 و CTA بلافاصله نمایش داده می‌شوند (قفل `videoFinished` حذف شد). |
| OG image | `/public/og-default.png` موجود است (1200×630، هویت سبز/طلایی/کرم). |
| Auth | لاگین/ثبت‌نام دمو است و به API واقعی وصل **نیست**. |
| پرداخت | `DevPaymentProvider` فقط در non-production. در production بدون `STRIPE_SECRET_KEY` درگاه خطا می‌دهد. checkout به `/api/orders` وصل نیست. |
| Credits | کیف اعتبار کلاینت (Zustand + ledger محلی). سمت سرور opt-in با `AI_SERVER_CREDITS=1` و هویت از session. |
| دیتابیس | repositories اگر `DATABASE_URL` باشد کوئری می‌زنند و در خطا به mock برمی‌گردند تا prerender کرش نکند. |
| CSP | فقط `Content-Security-Policy-Report-Only` (اجباری نیست تا دمو نشکند). |

---

## چه چیزهایی در این پاس سخت‌شد

### امنیت سرور
- پرداخت جعلی در production مسدود شد.
- `fail()` پیام خام exception را به کلاینت برنمی‌گرداند.
- مقایسه `CRON_SECRET` با `crypto.timingSafeEqual`.
- `/api/ai`: با `AI_SERVER_CREDITS=1` فقط `userId` از `requireUser`؛ payload کلاینت نادیده گرفته می‌شود.
- rate limiter مشترک + پاک‌سازی bucketهای منقضی + IP سخت‌گیرانه‌تر (`x-real-ip` سپس آخرین hop معتبر `x-forwarded-for`).
- CSP Report-Only.
- مایگریشن RLS: محدود کردن INSERT روی `analytics_events`، بستن خواندن recommendations سشن دیگران، اصلاح MIME `imagepng` → `image/png`.

### پایداری بیلد
- pool با timeout کوتاه؛ repositories در خطای DB به mock برمی‌گردند.
- `sitemap.ts` از repositories می‌خواند (خروجی mock همان قبلی).

### AI کاربر
- بعد از تولید موفق، سشن در `useDesignSessions` ذخیره می‌شود.
- `/ai/history` و `/ai/result/[id]` داده mock نشان نمی‌دهند؛ بدون سشن → EmptyState.
- دانلود واقعی (dataURL → blob) و بازتولید واقعی pipeline.

---

## باقی‌مانده برای لانچ (Must-have)

1. **اتصال repositories به DB واقعی** و مهاجرت صفحات از `@/data` به repository (جز sitemap/سبک که شروع شده).
2. **Auth واقعی** (Supabase Auth + OTP پیامک + قطع لاگین دمو).
3. **درگاه پرداخت ایرانی** (زرین‌پال / IDPay / …) + webhook؛ تبدیل تومان↔ریال (`currency: "IRR"` الان با مبلغ تومانی ثبت می‌شود — TODO در `/api/credits/purchase`).
4. **Credits سمت سرور** به‌صورت پیش‌فرض (الان opt-in).
5. **هاست داخلی / دامنه / SSL** و فعال‌سازی HSTS preload روی دامنه نهایی.
6. **پیامک OTP** و اطلاعیه‌های سفارش.
7. **اینماد** و اطلاعات حقوقی فوتر.
8. Object storage برای عکس اتاق / خروجی AI (الان data URL در localStorage).
9. جستجوی واقعی (الان فیلتر لوکال).
10. Sentry / error tracking و analytics production.
11. `next/image` در صورت تصمیم محصولی — الان تعمداً `<img>` است تا ظاهر دمو نشکند.
12. Rate limit توزیعی (Redis) برای چند instance.

**عمداً در این پاس انجام نشد (طبق قوانین):**
- اتصال UI لاگین/ثبت‌نام به API واقعی
- اتصال checkout به `/api/orders` یا درگاه
- مهاجرت کامل صفحات از `src/data` به repositories
- تغییر پنل‌های admin/vendor غیر از امنیت فهرست‌شده
- قابلیت جدید UI

---

## قراردادهایی که نباید شکسته شوند

- هیچ تغییر پیکسلی در ظاهر دمو مگر باگ صریح فهرست‌شده.
- `src/data/*` فقط خوانده می‌شود.
- سایت باید بدون `DATABASE_URL` بیلد شود.
- کلیدها فقط `process.env` سمت سرور؛ هیچ `NEXT_PUBLIC_` برای secret.
- UI AI فقط از `src/services/ai/index.ts` با `POST /api/ai`.
