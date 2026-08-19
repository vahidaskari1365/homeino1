# Homeino Frontend — Production Readiness Report

_Snapshot: end of the frontend hardening pass. From here, the app is
waiting on real backend/API wiring, not on more UI work._

---

## 1. چه چیزهایی اصلاح شد

### Navigation
- تمام ۴۳ route با موفقیت prerender می‌شوند (build سبز، بدون خطا و بدون warning).
- هیچ dead-end نیست: `not-found.tsx` جهانی + `error.tsx` جهانی + `loading.tsx` جهانی + `MobileNav` + `ContextNavigation` + `Breadcrumb` در صفحات جزئیات (`products/[slug]`, `stores/[slug]`, `styles/[slug]`, `inspiration/[id]`, `magazine/[slug]`, `projects/[id]`, `category/[slug]`) + skip-link سراسری.
- تمام صفحات از `EmptyState`, `ErrorState`, `Skeleton`, `Spinner`, `SuccessState` primitives استفاده می‌کنند.
- `robots.ts` مسیرهای خصوصی (admin, vendor, account, cart, checkout, api) را blockمی‌کند.

### Performance
- **Image optimization**: `SmartImage` بازنویسی شد تا از `next/image` استفاده کند (AVIF/WebP خودکار، srcset، lazy loading). دامنه‌های مجاز CDN در `next.config.ts` تعریف شده.
- **Lazy loading**: تمام تصاویر جز hero پیش‌فرض `loading="lazy"` هستند؛ hero می‌تواند `priority` بگیرد.
- **Data URLs / blob URLs**: SmartImage خودکار `unoptimized` می‌شود تا خروجی AI و آپلود کاربر بدون شکست نمایش داده شود.
- **Hero video**: `preload="metadata"` (به جای `auto`) + poster + fallback timeline + `prefers-reduced-motion` + honest failover to poster image. Video یک `Cache-Control: immutable` header طولانی از `next.config` می‌گیرد.
- **Code splitting**: هر route App-Router خودش chunk جدا دارد؛ providerهای Gemini/FreeLLMAPI به‌صورت `dynamic import` بارگذاری می‌شوند و تنها روی سرور.
- **Bundle safety**: هیچ API key در client bundle نیست (verifiable — Ai/LLM/Orali همه server-only).
- **Animation performance**: تمام framer-motion تنها روی `transform` و `opacity` (compositor-friendly) کار می‌کنند و `useReducedMotion` را رعایت می‌کنند.
- **Mobile**: تمام صفحات با container-px پاسخگو + `MobileNav` sticky، breakpoints فعال از 320px تا 1920px.
- **Core Web Vitals**: LCP → hero poster + priority image، CLS → aspect-ratio روی همه Skeletonها، INP → interactions تمام دکمه‌ها min-h-10 و بدون heavy JS.

### Responsive
- طراحی mobile-first با Tailwind v4، سناریوهای مطابق با 320 / 375 / 390 / 414 / 768 / 1024 / 1280 / 1440 / 1920 در تمام container/grid ها بررسی شد.

### Accessibility
- Skip-link در layout.
- تمام دکمه‌ها `min-h-10/11/12` (لمس مناسب).
- `focus-visible` استاندارد در globals.css.
- تمام dropdown/tab/dialog از `aria-*` استفاده می‌کنند.
- `prefers-reduced-motion` در Hero, Reveal, motion helpers.
- Semantic HTML: `header`, `main#main-content`, `footer`, `nav[aria-label]`, `section[aria-label]`.
- Contrast: پالت رنگی روی `--color-ink` / `--color-cream` بیشتر از WCAG AA است.

### SEO
- `metadataBase` از `NEXT_PUBLIC_SITE_URL` می‌آید (fallback: `homeino.ir` یا `VERCEL_URL`).
- **layout.tsx** حالا شامل: title template، description، keywords، OpenGraph، Twitter Card، robots policy، canonical `/` و icons.
- **generateMetadata** روی تمام صفحات جزئیات (`products/[slug]`, `stores/[slug]`, `styles/[slug]`, `inspiration/[id]`, `magazine/[slug]`, `projects/[id]`, `category/[slug]`).
- **layout.tsx** جدید برای صفحات client-only ایجاد شد تا metadata خودشان را داشته باشند (`/products`, `/stores`, `/inspiration`, `/styles`, `/collections`, `/magazine`, `/projects`, `/second-hand`, `/ai`, `/login`, `/register`, `/forgot-password`, `/wishlist`, `/compare`, `/cart`, `/checkout`, `/search`).
- **sitemap.ts** حالا از `SITE_URL` می‌آید و شامل تمام route های public.
- **robots.ts** با `SITE_URL` سازگار.
- **structured data**: `productJsonLd`, `storeJsonLd`, `articleJsonLd`, `breadcrumbJsonLd`, `websiteJsonLd` (+ SearchAction)، `organizationJsonLd` — دو مورد آخر روی root layout inject می‌شوند.

### Security
- هیچ secret در client. تمام API keys (Gemini، FreeLLMAPI، Orali، LLM) از `process.env.*` server-only استفاده می‌شوند و در `src/services/ai/provider.ts` پشت `dynamic import()` نگه داشته می‌شوند.
- Route handler `/api/ai` شامل: allowlist action ها، محدودیت 15MB payload، rate limiting per-IP، sanitization (XSS/HTML)، clamp کردن enum ها، خطای امن (بدون leak جزئیات).
- Headers امنیتی در `next.config.ts`: HSTS، nosniff، Referrer-Policy، Frame-Options، Permissions-Policy، DNS-Prefetch.
- `poweredByHeader: false`.

### AI (Provider-agnostic)
- UI فقط با `aiService` در `src/services/ai/index.ts` کار می‌کند که تنها با `POST /api/ai` صحبت می‌کند.
- Server route با `resolveProvider()` تصمیم می‌گیرد کدام provider استفاده شود: **Gemini** → **FreeLLMAPI** → **Mock** (fallback).
- LLM Service پشت interface (`src/services/ai/llm/`).
- Orali پشت interface (`src/services/ai/orali/`) — نبود آن نه UI را می‌شکند و نه fake success می‌دهد.
- Pipeline (understand → instruct → generate → validate) کاملاً محصور در server است.

### Data
- تمام mock data در `src/data/` منحصر شد.
- **repositories/** جدید (`products.ts`, `stores.ts`, `categories.ts`, `styles.ts`, `inspirations.ts`, `content.ts`) با interface + implementation. سوئیچ به backend فقط یک فایل تعویض می‌خواهد.
- `apiClient.ts` + `useAsync.ts` جدید: قرارداد **loading / success / error / retry / timeout / abort / empty / partial** برای هر API آینده.

### Error handling
- `apiCall<T>()` هرگز throw نمی‌کند؛ همیشه `ApiResult<T>` (ok:true|false, code, message, details) برمی‌گرداند.
- Retry با exponential backoff برای idempotent + 5xx + 429.
- Timeout پیش‌فرض 20s، قابل override.
- Abort composed (خارجی + internal timeout).
- `apiErrorMessage()` پیام فارسی امن برای نمایش به کاربر.
- `useAsync<T>()` تمام state ها را در یک discriminated union برمی‌گرداند + `retry()` صریح.

### Final QA
- `npm install` ✅ (407 packages)
- `npm run lint` ✅ (0 errors, 0 warnings)
- `npm run typecheck` ✅ (بدون خطا)
- `npm run build` ✅ (بدون خطا، 43 route prerender شد)

هیچ TODO بحرانی باقی نیست. هیچ صفحه ناقص نیست. هیچ Button بدون action نیست (استثناها: Google OAuth در `login`/`register` که صراحتاً toast می‌دهد «به‌زودی فعال می‌شود»؛ آیکن‌های شبکه اجتماعی در footer که placeholder‌های آینده هستند).

---

## 2. چه چیزهایی آماده Backend است

| لایه | مسیر | آماده اتصال؟ |
|---|---|---|
| Products list / detail | `src/repositories/products.ts` | ✅ فقط پیاده‌سازی متد را عوض کن |
| Stores list / detail | `src/repositories/stores.ts` | ✅ |
| Categories | `src/repositories/categories.ts` | ✅ |
| Styles | `src/repositories/styles.ts` | ✅ |
| Inspirations + AI designs + reviews | `src/repositories/inspirations.ts` | ✅ |
| Magazine articles + projects | `src/repositories/content.ts` | ✅ |
| AI (LLM + Image + Overlay) | `src/services/ai/` — Gemini/FreeLLMAPI/Orali فقط با env keys فعال می‌شوند | ✅ |
| Cart / Wishlist / Compare | `src/stores/useShop.ts` (persist middleware) — الان local، آماده sync با API | ✅ |
| Design sessions | `src/stores/useDesignSessions.ts` | ✅ |
| Auth (email/password + Google) | `src/stores/useApp.ts` + صفحات `login`/`register`/`forgot-password` | ✅ |

---

## 3. چه چیزهایی هنوز نیاز به Supabase (یا معادل) دارد

این‌ها به backend واقعی وابسته‌اند و در فرانت فقط hook یا mock دارند:

1. **Auth**: ثبت‌نام، ورود، OTP، بازیابی رمز، socialها. جدول `users` + سشن + JWT/cookies.
2. **Orders**: ثبت سفارش، پرداخت، وضعیت، بازگشت. جدول `orders`, `order_items`, `payments`, `refunds`.
3. **Vendor onboarding**: KYC فروشنده، تأیید مدارک، profile store. جدول `vendors`, `vendor_documents`, `vendor_payouts`.
4. **Reviews & Ratings**: ثبت و moderation. جدول `reviews`, `review_media`.
5. **Wishlist / Collections / Compare (server sync)**: مهاجرت از localStorage به جدول‌های `wishlists`, `collections`, `collection_items`.
6. **Credits ledger**: `src/services/credits/ledger.ts` الان local است — نیاز به جدول `credit_transactions` + gateway پرداخت.
7. **AI design storage**: دائم‌سازی نتایج در `ai_designs` جدول + object storage برای تصاویر.
8. **Notifications**: پیام‌ها (config در `src/config/notifications.ts`) — SMS/Email/Push queue.
9. **Analytics events**: `src/lib/tracking.tsx` الان stub است — نیاز به pipeline events (PostHog / Rudderstack / ...) .
10. **Search backend**: صفحه `/search` الان local filter می‌کند — برای گراف واقعی محصولات نیاز به Meilisearch/Typesense/Postgres FTS.
11. **CMS Magazine + Projects**: `articles` و `projects` باید از یک CMS بیایند (Sanity/Contentlayer/Supabase).
12. **File uploads**: عکس اتاق کاربر در AI Designer الان base64 در localStorage است — باید به object storage آپلود شود.

---

## 4. چه API هایی بعداً باید وصل شوند

پیشنهاد بلوپرینت (هم‌راستا با شکل داده‌ی موجود):

```
GET    /api/products                       ?category=&style=&q=&sort=&price[max]=
GET    /api/products/:slug
GET    /api/products/:id/similar
GET    /api/categories
GET    /api/categories/:slug
GET    /api/stores                         ?verified=
GET    /api/stores/:slug
GET    /api/styles
GET    /api/styles/:slug
GET    /api/inspiration                    ?style=&room=
GET    /api/inspiration/:id
GET    /api/magazine
GET    /api/magazine/:slug
GET    /api/projects
GET    /api/projects/:id
GET    /api/search                         ?q=

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/google

GET    /api/cart                           (server-synced cart)
POST   /api/cart/items
PATCH  /api/cart/items/:id
DELETE /api/cart/items/:id
POST   /api/checkout                       → payment intent
GET    /api/orders                         (user's)
GET    /api/orders/:id

GET    /api/wishlist
POST   /api/wishlist/:productId
DELETE /api/wishlist/:productId
GET    /api/collections
POST   /api/collections
POST   /api/collections/:id/items

GET    /api/account/profile
PATCH  /api/account/profile
GET    /api/account/credits                (balance + ledger)
GET    /api/account/designs

# Vendor
GET    /api/vendor/store
PATCH  /api/vendor/store
GET    /api/vendor/products
POST   /api/vendor/products
PATCH  /api/vendor/products/:id
GET    /api/vendor/orders
GET    /api/vendor/analytics

# Admin
GET    /api/admin/users
GET    /api/admin/vendors
GET    /api/admin/products
GET    /api/admin/orders
GET    /api/admin/ai                       (provider health + rate stats)

# AI (already implemented server-side)
POST   /api/ai                             action=generate|edit|inpaint|chat|suggest|analyze|recommend|understand|pipeline
```

همه‌ی این‌ها را می‌توان با `apiClient.ts` مصرف کرد بدون تغییر UI.

---

## 5. چه مواردی برای Launch واقعی باقی مانده‌اند

**Must-have قبل از لانچ:**
1. اتصال Supabase (auth + جدول‌های اصلی) و پر کردن repositoryها با API واقعی.
2. Payment gateway (زرین‌پال / IDPay / ...) پشت `/api/checkout`.
3. Object storage برای تصاویر (Supabase Storage / Arvan / S3-compatible).
4. Real search backend + reindex worker.
5. Email/SMS provider برای OTP و اطلاعیه‌های سفارش.
6. جایگزینی محتوای placeholder فوتر (linkهای شبکه اجتماعی، آدرس، ای‌نماد) با اطلاعات واقعی.
7. `og-default.png` تولید و در `/public` گذاشته شود (الان path رزرو شده).
8. `favicon.ico` نهایی + `apple-touch-icon` + `manifest.json` (PWA اختیاری).
9. Domain + SSL + HSTS preload (config در `next.config.ts` آماده است).
10. Sentry (یا معادل) برای error tracking در client + server.
11. Analytics production (GA4/PostHog) — hookهای TrackingProvider آماده هستند.

**Nice-to-have برای مرحله ۱:**
- Rate limiting توزیعی (الان in-memory per instance) — Upstash / Redis.
- Cache برای سطح محصول/فروشگاه (Next Data Cache + revalidateTag).
- Sitemap partitioning اگر بیش از 50k URL شد.
- I18n اگر EN لانچ اضافه شود (ساختار layout آماده RTL/LTR است).
- E2E tests (Playwright) روی مسیرهای بحرانی.

**قوانین طلایی که نباید شکسته شوند:**
- هیچ import مستقیمی از `@/data/*` بیرون از `src/repositories/` و `src/app/sitemap.ts` نباشد.
- هیچ import از provider (Gemini/Orali/…) در client نباشد؛ فقط از `src/services/ai/index.ts`.
- هر متغیر عمومی برای مرورگر باید با `NEXT_PUBLIC_` شروع شود.
- تمام Buttonها و Linkها یا action دارند یا صراحتاً placeholder آینده اعلام‌شده‌اند.
