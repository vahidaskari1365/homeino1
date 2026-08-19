# Homeino — Frontend Architecture Audit & نقشه اجرایی

> تهیه‌شده در نقش Lead Software Architect / Principal Frontend Engineer
> برنچ: `arena/01a018b4-homeino1` · پایه: `main` (commit `a538711`)
> تاریخ: ۲۰۲۶-۰۸-۱۹

---

## ۱. خلاصه‌ی اجرایی (Executive Summary)

Homeino از نظر **معماری بنیادین** بسیار خوب طراحی شده است: App Router تمیز،
RTL/فارسی کامل، جداسازی AI پشت یک Provider Contract، سیستم اعتبار مبتنی بر
Ledger، RBAC، لایه Tracking بدون وابستگی، و پایه‌ی SEO (JSON-LD / sitemap / robots).
این‌ها سرمایه‌ی واقعی پروژه‌اند و باید **حفظ شوند**.

اما سه مشکل ساختاری جدی وجود دارد که باید قبل از هر پیشرفت رفع شوند:

1. **صفحه‌ی اصلی ناقص است.** فایل `src/app/page.tsx` در انتها با کامنت
   `{/* rest of the page unchanged... */}` تمام می‌شود و فقط Hero و یک نوار
   Value Strip را رندر می‌کند. تمام بخش‌های Marketplace (گرید محصول، فروشگاه‌ها،
   الهام‌بخشی، دسته‌بندی‌ها و…) حذف شده‌اند ولی ~۱۵ ایمپورت مربوط به آن‌ها
   باقی مانده (Dead Code). این یعنی «پلتفرم جامع» بودن در مهم‌ترین لندینگ دیده نمی‌شود.
2. **همه‌چیز Mock است** (۴۰ محصول، ۱۰ فروشگاه، سفارش‌ها، کاربران، اعتبار، Auth).
   این در فاز فعلی پذیرفته‌شده است، اما **state اولیه‌ی آلوده** دارد: سبد خرید،
   علاقه‌مندی و مقایسه با داده‌ی پیش‌فرض hard-coded شروع می‌شوند (مثلاً سبد ۲ آیتم دارد).
3. **Duplication و Dead Code قابل‌توجه** در لایه‌ی اعتبار/AI و تعدادی ایمپورت بلااستفاده.

هیچ قابلیتی حذف نشده است. این سند فقط وضعیت را ثبت و مسیر اجرا را مشخص می‌کند.

---

## ۲. Architecture Map (نقشه‌ی معماری)

### ۲.۱ پشته‌ی فناوری (Tech Stack)

| لایه | تکنولوژی | نسخه |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.6 |
| Styling | Tailwind CSS v4 (CSS-first, `@theme`) | 4.1.17 |
| State | Zustand (+ persist) | 5.0.15 |
| Animation | Framer Motion | 13.1.0 |
| Icons | lucide-react | 1.31.0 |
| DB (آماده، غیرفعال) | Drizzle ORM + `pg` | 0.45.2 |
| Utils | clsx + tailwind-merge | — |
| Lang | TypeScript strict | 5.9.3 |

> ⚠️ DB فقط اسکلت است: `src/db/schema.ts` خالی است (`export {}`) و `getDb()`
> بدون `DATABASE_URL` خطا می‌دهد. `drizzle-kit` و `pg` فعلاً وابستگی غیرضروریِ
> فعال‌نشده‌اند (ببینید §۳، مورد R-2).

### ۲.۲ نمای کلی ساختار

```
src/
├── app/            # 46 page + 10 layout + 2 route handler + robots/sitemap/not-found
├── components/
│   ├── auth/       # AuthShell (چیدمان ورود/ثبت‌نام)
│   ├── layout/     # AppShell, Header, Footer, MobileNav, SearchOverlay, AIPanel,
│   │               # GlobalChrome, DashboardLayout
│   ├── motion/     # Reveal, RevealGroup, RevealItem (اسکرول-ریویل)
│   ├── ui/         # primitives, SmartImage, MaskCanvas, BeforeAfterSlider
│   ├── cards.tsx   # ProductCard, StoreCard, InspirationCard
│   ├── shared.tsx  # Breadcrumb, PageHeader, ProductGrid, Stat, FilterGroup
│   └── ProductOverlay.tsx   # جای‌گذاری محصول روی عکس اتاق
├── config/         # platform.ts (ادعاهای پلتفرم), notifications.ts (ترجیحات)
├── data/           # 9 فایل Mock (categories, products, stores, styles, offers,
│                   # inspirations, content, secondHand, media)
├── db/             # index.ts (getDb) + schema.ts (خالی)
├── lib/            # utils, seo (JSON-LD), share, tracking, auth/permissions, overlayGeometry
├── services/
│   ├── ai/         # index (aiService), types, provider, geminiProvider,
│   │               # freellmapi, mockAiService, credits, roomState
│   └── credits/    # ledger.ts (Ledger + idempotency + anti-abuse + purchase)
├── stores/         # useApp (UI/Auth/Credits/Chat), useShop (Cart/Wishlist/Compare/Recent),
│                   # useRoomState (جلسه طراحی AI + undo/redo)
└── types/          # domain models (Product, Offer, Store, AiDesign, ...)
```

### ۲.۳ نقشه‌ی کامل Route‌ها (۴۶ صفحه)

| گروه | مسیر | نوع | فایل | وضعیت داده |
|---|---|---|---|---|
| **Home** | `/` | public | `app/page.tsx` | ⚠️ ناقص (فقط Hero + Value Strip) |
| **محصولات** | `/products` | public | `products/page.tsx` | Mock |
| | `/products/[slug]` | public + metadata | `products/[slug]/{page,layout}.tsx` | Mock + JSON-LD |
| **دسته‌بندی** | `/category/[slug]` | public + metadata | `category/[slug]/…` | Mock |
| **فروشگاه‌ها** | `/stores` | public | `stores/page.tsx` | Mock |
| | `/stores/[slug]` | public + metadata | `stores/[slug]/…` | Mock |
| **سبک‌ها** | `/styles` | public | `styles/page.tsx` | Mock |
| | `/styles/[slug]` | public + metadata | `styles/[slug]/…` | Mock |
| **الهام** | `/inspiration` | public | `inspiration/page.tsx` | Mock |
| | `/inspiration/[id]` | public + metadata | `inspiration/[id]/…` | Mock |
| **مجله** | `/magazine` | public | `magazine/page.tsx` | Mock |
| | `/magazine/[slug]` | public + metadata | `magazine/[slug]/…` | Mock |
| **پروژه‌ها** | `/projects` | public | `projects/page.tsx` | Mock |
| | `/projects/[id]` | public | `projects/[id]/page.tsx` | Mock |
| **دسته دوم** | `/second-hand` | public | `second-hand/page.tsx` | Mock + فرم آگهی |
| **جستجو** | `/search` | public | `search/page.tsx` | Mock (useSearchParams) |
| **مقایسه** | `/compare` | public | `compare/page.tsx` | از store |
| **علاقه‌مندی** | `/wishlist` | public | `wishlist/page.tsx` | از store |
| **سبد خرید** | `/cart` | public | `cart/page.tsx` | از store |
| **پرداخت** | `/checkout` | public | `checkout/page.tsx` | فرم (بدون درگاه) |
| | `/checkout/success` | public | `checkout/success/page.tsx` | ثابت |
| **Auth** | `/login` `/register` `/forgot-password` | public | `auth` صفحات | Mock (localStorage) |
| **AI** | `/ai` | public | `ai/page.tsx` | Mock |
| | `/ai/design` | public | `ai/design/page.tsx` | ⭐ بزرگ‌ترین صفحه (۵۸۳ خط) |
| | `/ai/history` | public | `ai/history/page.tsx` | Mock |
| | `/ai/result/[id]` | public | `ai/result/[id]/page.tsx` | Mock |
| **حساب** | `/account` + `/orders` `/designs` `/credits` `/profile` `/settings` | private | `account/**` | Mock |
| **فروشنده** | `/vendor` + `/products` `/products/new` `/orders` `/store` `/analytics` | private | `vendor/**` | Mock |
| **مدیریت** | `/admin` + `/users` `/vendors` `/products` `/orders` `/ai` | private | `admin/**` | Mock |
| **API** | `/api/ai` (POST/GET) | api | `api/ai/route.ts` | Gateway AI (سرور) |
| | `/api/health` | api | `api/health/route.ts` | به DB وابسته |
| **SEO** | `/sitemap.xml`, `/robots.txt` | metadata | `sitemap.ts`, `robots.ts` | از Mock |
| | `not-found` | — | `not-found.tsx` | — |

### ۲.۴ سلسله‌مراتب Layout

```
RootLayout (lang=fa dir=rtl, metadata, font Vazirmatn, themeColor)
 └── AppShell  (client) — Header + <main> + Footer + MobileNav
      ├── SearchOverlay   (زنجیره‌ای از useUi)
      ├── AIPanel         (چت شناور)
      ├── GlobalChrome    (دکمه AI، توست، اسکرول‌بالا، نوار مقایسه، چیپ اعتبار)
      └── TrackingProvider (Analytics context)
   به‌علاوه layout های اختصاصی:
      ├── account/layout → DashboardLayout (سایدبار)
      ├── vendor/layout  → DashboardLayout
      ├── admin/layout   → DashboardLayout
      └── 6× [dynamic]/layout → فقط generateMetadata (SEO)
```

### ۲.۵ State Management (Zustand — ۳ store + persist)

| Store | مسئولیت | persist key | نکته‌ی مهم |
|---|---|---|---|
| `useApp.ts` | `useUi` (overlay/toast)، `useAuth` (mock)، `useCredits` (Ledger)، `useChat` | `homeino-auth`, `homeino-credits` | Auth در dev همیشه مهمان است |
| `useShop.ts` | `useCart`، `useWishlist`، `useCompare`، `useRecentlyViewed` | `homeino-cart` … | ⚠️ state اولیه آلوده |
| `useRoomState.ts` | جلسه‌ی طراحی AI + undo/redo | بدون persist | تمیز، Single Source of Truth |

### ۲.۶ Data Models (‎`src/types/index.ts`)

`Product`, `Offer` (چندفروشگاهی)، `Seller`/`Store`/`Collection`،
`InspirationImage`, `AiMode`/`AiDesign`, `ChatMessage`, `Review`,
`CartItem`, `SecondHandProduct`, `CreditTransaction` — به‌همراه `CommissionRecord`
و `CommissionRecord` برای آینده. مدل «Product → Offer → Store» برای Marketplace
**درست و آینده‌نگر** طراحی شده است (هر محصول چند فروشنده دارد — `offers.ts`).

### ۲.۷ سرویس‌ها

- **AI**: یک `AiProvider` contract دارد. UI فقط `aiService` (‎`services/ai/index.ts`)
  را صدا می‌زند که به `/api/ai` می‌رود. `provider.ts` سمت سرور بین
  `mock` → `gemini` (با `GEMINI_API_KEY`) → `freellmapi` رزولوشن می‌کند.
  خروجی Mock با `preview: true` **صادقانه** برچسب پیش‌نمایش می‌خورد (هیچ جعلی رندر نمی‌شود).
- **Credits**: `ledger.ts` — وضعیت `reserved/committed/refunded/settled` +
  idempotency + anti-abuse + purchase placeholder. منطق Reserve→Commit→Refund عالی است.
- **roomState.ts**: تشخیص Intent، scope تغییرات، اعتبارسنجی نتیجه، `sanitizeUserPrompt`.

### ۲.۸ Navigation

- **Desktop**: Header با ۷ آیتم + mega menu (محصولات/دسته‌بندی/سبک‌ها).
- **Mobile**: `MobileNav` پایین صفحه + دکمه‌های شناور AI/اسکرول.
- **Overlayها**: SearchOverlay، AIPanel (چت)، GlobalChrome (توست/مقایسه).
- پیمایش متقاطع خوب است: AI Panel → `/ai/design`، تاریخچه → ادامه طراحی،
  الهام → محصول قابل خرید.

---

## ۳. یافته‌های Audit (اولویت‌بندی‌شده)

### 🔴 P0 — بحرانی (قبل از هر Launch)

| # | مشکل | محل | جزئیات |
|---|---|---|---|
| P0-1 | **صفحه‌ی اصلی ناقص** | `app/page.tsx` | با `{/* rest of the page unchanged... */}` تمام می‌شود؛ فقط Hero + Value Strip رندر می‌شود. Marketplace روی لندینگ غایب است. |
| P0-2 | **Dead imports در صفحه اصلی** | `app/page.tsx` | ~۱۵ ایمپورت بلااستفاده: `categories, styles, stores, collections, trendingProducts, inspirations, ProductCard, StoreCard, InspirationCard, Rating, LogoBlock, SectionHeading, Button, Reveal*, SmartImage, PLATFORM, AI_IMG` |
| P0-3 | **آدرس تصویر شکسته** | `app/page.tsx:22` | `AI_IMG = "/images/ai-feature.jpg"` — فایل وجود ندارد (public فقط `video/01.mp4` دارد) و اصلاً استفاده هم نشده |
| P0-4 | **State اولیه‌ی آلوده** | `stores/useShop.ts` | سبد با `[{p1,qty:1},{p15,qty:2}]`، علاقه‌مندی `[p9,p12]`، مقایسه `[p1,p29]` شروع می‌شوند → کاربر واقعی داده‌ی جعلی می‌بیند |
| P0-5 | **Auth فقط Mock + همیشه لاگین در dev** | `stores/useApp.ts` | `DEV_USER` در dev همیشه `user` را پر می‌کند؛ هیچ مسیر real auth وجود ندارد (طبق محدوده‌ی فاز، فعلاً ok ولی باید مستند و ایزوله باشد) |

### 🟠 P1 — بالا (Refactor پیش از Scale)

| # | مشکل | محل | جزئیات |
|---|---|---|---|
| P1-1 | **Duplication اعتبار** | `services/ai/credits.ts` ↔ `services/credits/ledger.ts` | `CREDIT_CONFIG` و `CREDIT_DISPLAY` هر دو `buyPackages`/`subscriptions` یکسان دارند؛ `OPERATION_COSTS` و `AI_OPERATION_COSTS` هم تکراری‌اند → منبع حقیقت واحد لازم است |
| P1-2 | **Duplicate import** | `app/page.tsx` | `stores` از `@/data/stores` سه‌بار ایمپورت شده (خطوط ۱۲، ۱۳، ۱۶) |
| P1-3 | **Hack سرکوب خطا** | `projects/page.tsx` | `void toFa;` برای ساکت‌کردن ایمپورت بلااستفاده — نشانه‌ی نبود lint برای unused |
| P1-4 | **صفحه‌ی AI Design خیلی بزرگ** | `ai/design/page.tsx` (۵۸۳ خط) | ۵۴ ثابت داده‌ی دسته‌بندی + ۲ زیرکامپوننت + منطق چندتبه در یک فایل؛ باید به ماژول تجزیه شود |
| P1-5 | **پرداخت بدون درگاه** | `checkout`, `credits/ledger.ts` | `requestPurchase` همیشه موفق برمی‌گرداند؛ طبق محدوده ok ولی باید با placeholder واضح باشد |
| P1-6 | **Rate-limit/abuse فقط کلاینت** | `useApp.ts`, `ledger.ts` | idempotency با `Set` در مموری کلاینت — با رفرش از بین می‌رود؛ `/api/ai` rate-limit سرور دارد اما اعتبار کلاینت است |

### 🟡 P2 — متوسط (کیفیت/UX/A11y/SEO)

| # | حوزه | جزئیات |
|---|---|---|
| P2-1 | **Lint** | `eslint.config.mjs` فقط `core-web-vitals` دارد؛ `no-unused-vars` فعال نیست → Dead Code انباشته شده. `tsconfig` فاقد `noUnusedLocals`/`noUnusedParameters` |
| P2-2 | **A11y** | بیشتر `<img>` بدون alt معنادار (`alt=""` یا عنوان‌ها)؛ برخی دکمه‌های آیکونی بدون label در کارت‌ها؛ فونت از CDN با `<link>` نه `next/font` (تأخیر و FOUT) |
| P2-3 | **SEO** | `sitemap.ts` از Mock تولید می‌شود (ok موقت)؛ `metadataBase` و canonical خوب است؛ اما صفحات `search`, `cart`, `wishlist`, `compare`, `ai/*` بدون metadata اختصاصی |
| P2-4 | **Loading/Error/Empty** | فقط `ProductGrid` و چند نقطه Skeleton/EmptyState دارند؛ `ai/design` و اکثر صفحات حالت خطای سیستماتیک ندارند؛ `/api/ai` خطا را فقط به صورت generic برمی‌گرداند (عمداً، اما UI بازخورد محدود دارد) |
| P2-5 | **Consistency** | ترکیب `<button>` خام با `Button` و `btn-*` کلاس‌ها ناسازگار است؛ قیمت‌ها با دو روش (`formatPrice` vs `toLocaleString("fa-IR")`) قالب‌بندی می‌شوند |
| P2-6 | **Performance** | ویدئوی Hero با `preload="auto"` + Framer parallax روی همه‌ی موبایل‌ها؛ SmartImage lazy دارد ولی بسیاری `<img>` خام بدون lazy/placeholder؛ فونت CDN مسدودکننده |
| P2-7 | **دسته دوم (second-hand)** | فرم آگهی فقط toast می‌دهد (بدون ذخیره)؛ دکمه علاقه‌مندی از `toggleProduct` روی id دسته‌دوم استفاده می‌کند که با store محصول تداخل id دارد |

### 🟢 P3 — کم‌اهمیت

- `db/` و `drizzle-kit` + `pg` وابستگی‌های فعلاً بلااستفاده (ببینید R-2).
- `lib/share.ts` و `config/notifications.ts` عالی نوشته شده‌اند ولی هنوز مصرف‌کننده‌ی واقعی ندارند.
- `useRecentlyViewed` تعریف شده ولی به‌نظر در هیچ صفحه‌ای `track` صدا زده نمی‌شود.
- `TrackingProvider` ساخته شده ولی `useTracking()`/`trackEvent` به‌صورت پراکنده (عمدتاً AI design) استفاده شده است.

---

## ۴. تصمیم‌های معماری (Keep / Refactor / Replace / Launch / Don't)

### ✅ باید حفظ شود (KEEP)
- ساختار App Router + `lang=fa dir=rtl` + metadata پویا (اسکلت SEO).
- سیستم طراحی با Tailwind v4 و CSS variables (`globals.css`).
- **Provider Contract برای AI** (`AiProvider`) و جداسازی کلیدها سمت سرور.
- **Ledger اعتبار** (Reserve/Commit/Refund + idempotency) — طراحی اقتصادی درست.
- `AiProvider` honest-preview flag (هیچ تصویر جعلی رندر نمی‌شود).
- `RBAC` (`lib/auth/permissions.ts`) و `tracking.tsx`.
- مدل داده‌ی `Product → Offer → Store` (هسته‌ی Marketplace چندفروشگاهی).
- `primitives.tsx`, `SmartImage`, `BeforeAfterSlider`, `MaskCanvas`, `ProductOverlay`.
- `sitemap.ts`, `robots.ts`, `lib/seo.ts` (JSON-LD).

### 🔧 باید Refactor شود (REFACTOR)
- `app/page.tsx` → تکمیل بخش‌های Marketplace + حذف ایمپورت‌های مرده + رفع آدرس تصویر.
- `ai/design/page.tsx` → تجزیه به ماژول (داده‌ی دسته‌بندی → فایل مستقل، SuggestAssistant → کامپوننت جدا، مراحل → کامپوننت).
- `services/ai/credits.ts` + `services/credits/ledger.ts` → یک منبع حقیقت واحد برای هزینه‌ها/پکیج‌ها.
- `stores/useShop.ts` → state اولیه‌ی خالی (حذف داده‌ی hard-coded).
- قالب‌بندی قیمت → یک ابزار واحد (`formatPrice`) به‌جای `toLocaleString` پراکنده.
- `eslint.config.mjs` + `tsconfig` → فعال‌سازی `no-unused-vars` / `noUnusedLocals`.

### 🔁 باید Replace شود (REPLACE) — در فازهای بعدی (نه اکنون)
- Auth mock → Supabase Auth (در فاز Backend).
- `requestPurchase` → درگاه پرداخت واقعی (Zarinpal/IDPay) + webhook.
- `src/data/*` → API/DB واقعی (Supabase).
- `db/schema.ts` خالی → اسکیمای واقعی Drizzle.
- Rate-limit کلاینت → اجرای authoritative در Backend.

### 🚀 برای Launch ضروری است (MUST)
1. تکمیل صفحه‌ی اصلی (Marketplace کامل و قابل پیمایش).
2. پاک‌سازی state اولیه‌ی آلوده (سبد/علاقه‌مندی/مقایسه خالی).
3. رفع Dead Code و ایمپورت‌های مرده + فعال‌سازی lint.
4. مسیرهای حیاتی خرید: Products → Product → Cart → Checkout (با placeholder پرداخت).
5. AI Studio با برچسب preview صادقانه + مسیر اعتبار.
6. A11y پایه (alt/aria) و loading/error/empty در مسیرهای اصلی.

### 🚫 فعلاً نباید ساخته شود (NOT NOW)
- Backend واقعی / Supabase / Auth واقعی / Payment / API production (به‌صراحت در محدوده).
- سیستم ارجاع (referral)، نوتیفیکیشن push/SMS، سیستم امتیاز/لویالتی.
- ویرایشگر پیشرفته AI (inpainting واقعی با مدل) — تا وقتی provider واقعی متصل نیست.
- داشبورد آنالیتیکس فروشنده و admin (فعلاً Mock کافی است).

---

## ۵. نقشه‌ی اجرایی Frontend (Execution Roadmap)

### فاز ۰ — پاک‌سازی بنیادی (این فاز)
1. فعال‌سازی `no-unused-vars` در ESLint + `noUnusedLocals/Parameters` در tsconfig.
2. حذف ایمپورت‌های مرده و `void toFa;`.
3. یکپارچه‌سازی منبع حقیقت اعتبار (merge `CREDIT_CONFIG`/`CREDIT_DISPLAY` و هزینه‌ها).
4. خالی‌کردن state اولیه‌ی Cart/Wishlist/Compare.

### فاز ۱ — تکمیل صفحه‌ی اصلی (Landing)
1. بازسازی بخش‌های: گرید محصولات منتخب، فروشگاه‌های برتر، الهام‌بخشی، دسته‌بندی‌ها، سبک‌ها، CTA نهایی.
2. رفع/حذف `AI_IMG` (آدرس شکسته).
3. افزودن loading skeleton و lazy برای تصاویر Hero.

### فاز ۲ — قوام UI/UX
1. یکسان‌سازی `Button`/`Price`/`Breadcrumb` در همه‌ی صفحات.
2. افزودن Empty/Error/Loading استاندارد در مسیرهای اصلی.
3. بهبود A11y (alt، aria-label، focus states).
4. جابه‌جایی فونت به `next/font` (حذف وابستگی CDN).

### فاز ۳ — تجزیه‌ی AI Studio
1. استخراج داده‌ی دسته‌بندی و زیرکامپوننت‌ها از `ai/design/page.tsx`.
2. اتصال trackEvent سراسری به تعاملات کلیدی.

### فاز ۴ — آماده‌سازی برای Backend (بدون پیاده‌سازی)
1. تعریف interface برای سرویس‌های آینده (auth/payment/products) تا جایگزینی یک‌فایلی باشد.
2. مستندسازی قرارداد API (OpenAPI-lite) برای فاز بعدی.

### فاز ۵ (خارج از این مرحله)
- اتصال Supabase/Auth/Payment/API production.

---

## ۶. گام بعد (Next Step)

پس از تأیید این نقشه، وارد **فاز ۰ + فاز ۱** می‌شویم: پاک‌سازی dead code و تکمیل
صفحه‌ی اصلی، بدون دست‌زدن به Backend و بدون حذف هیچ قابلیتی.

---

*نسخه: 1.0 — برای بازبینی و تأیید ذی‌نفعان.*
