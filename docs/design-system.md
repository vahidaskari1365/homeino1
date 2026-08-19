# Homeino Premium Design System

نسخه ۲ — Mobile-first / RTL-first

## اصول تجربه

1. **وضوح قبل از تزئین:** کاربر در هر صفحه باید بداند کجاست، چه کاری می‌تواند انجام دهد و قدم بعد چیست.
2. **گرم و قابل اعتماد:** Ivory گرم، Emerald عمیق و Champagne Gold؛ رنگ طلایی فقط برای نقاط باارزش و CTAهای ممتاز استفاده می‌شود.
3. **لوکس اما کاربردی:** عمق با بافت، نور، عکاسی و سایه ساخته می‌شود؛ نه با شلوغی.
4. **بدون بن‌بست:** `ContextNavigation` در تمام routeهای غیر از Home دکمه بازگشت استاندارد، parent route و breadcrumb کوتاه ارائه می‌دهد.
5. **Mobile-first:** حداقل target لمسی اصلی 44px، modal و drawer محدود به `100svh`، محتوای عریض فقط داخل scroll container کنترل‌شده.

## Tokens

منبع حقیقت tokenها: `src/app/globals.css` در `@theme`.

### رنگ

- `ink / ink-soft`: متن، سطوح cinematic و CTA اصلی
- `ivory / ivory-2 / cream`: پس‌زمینه و surfaceهای گرم
- `terracotta*`: در نام legacy باقی مانده اما نقش رنگ برند Emerald را دارد
- `gold / gold-soft`: تأکید ممتاز، اعتبار و AI
- `success / warning / danger / info`: فقط معنای semantic

### Typography

فونت self-hosted از پکیج `@fontsource-variable/vazirmatn` بارگذاری می‌شود؛ وابستگی CDN حذف شده است.

- Display: وزن 850–900، line-height 1.2–1.25
- Heading: اندازه fluid با `clamp`
- Body: 14–16px، line-height 1.75–1.9
- Caption: 10–12px فقط برای metadata
- متن‌ها به‌صورت پیش‌فرض wrap می‌شوند و عنوان‌های بلند از viewport خارج نمی‌شوند.

### Spacing

ریتم بر پایه 4px است:

- Control gaps: 4 / 8 / 12px
- Card padding: 12px موبایل، 16–24px desktop
- Page gutter: `--space-page` = 16px تا 48px
- Section: `--space-section` = 56px تا 120px

### Radius

- `xs 6`: جزئیات کوچک
- `sm 10`: button/input
- `md 14`: panel موبایل
- `lg 20`: card
- `xl 28`: feature/modal
- `2xl 40`: cinematic hero

### Elevation

- `shadow-soft`: card عادی
- `shadow-card`: hover / dropdown / toast
- `shadow-lift`: modal / drawer / floating UI
- `shadow-glow` و `shadow-gold`: CTAهای برند و AI

## Components

منبع: `src/components/ui/primitives.tsx`

- Layout: `Container`, `SectionHeading`
- Actions: `Button`, `ButtonLink`
- Forms: `TextField`, `SelectField`, `FaNumberInput`
- Data: `Badge`, `Chip`, `Rating`, `Price`, `LogoBlock`
- Navigation: `Tabs`, `Breadcrumb`, `ContextNavigation`
- Feedback: `Spinner`, `Skeleton`, `LoadingState`, `StatusBanner`
- States: `EmptyState`, `ErrorState`, `ConfirmationState`
- Overlays: `Modal`, `ConfirmDialog`, `Drawer`
- Global feedback: toast stack در `GlobalChrome`

## Responsive rules

- viewport هدف حداقل: 320px.
- grid محصول در موبایل دو ستونه و کارت‌ها `min-width: 0` دارند.
- tableها فقط داخل `.table-shell` اسکرول افقی داخلی دارند و خود صفحه overflow نمی‌شود.
- navigation موبایل bottom bar پنج‌گزینه‌ای و drawer گروه‌بندی‌شده دارد.
- footer در موبایل safe bottom padding دارد.
- sticky product CTA بالاتر از mobile navigation قرار می‌گیرد.
- تصاویر با `SmartImage` دارای skeleton، fallback، lazy-load و `object-cover` هستند.
- modal در موبایل bottom-sheet و در desktop dialog مرکزی است؛ drawer حداکثر 90vw عرض دارد.

## Back behavior

`ContextNavigation` برای هر route یک parent معنایی تعریف می‌کند. کلیک «بازگشت»:

1. اگر browser history موجود باشد، `router.back()` اجرا می‌شود.
2. در ورود مستقیم، parent route معنایی با `router.push()` باز می‌شود.

نمونه‌ها:

- Product → Products
- Store detail → Stores
- AI Design → AI Studio
- AI Result → AI History
- Checkout → Cart
- Account internal → Account
- Vendor/Admin internal → dashboard root

## Accessibility

- Skip link سراسری به `#main-content`
- focus ring طلایی با contrast بالا
- `aria-current`, `aria-selected`, `aria-pressed`, dialog semantics
- toast با `aria-live`
- targetهای اصلی حداقل 44px
- پشتیبانی از `prefers-reduced-motion`
- alt و fallback استاندارد در `SmartImage`

## Page states

- `src/app/loading.tsx`: skeleton عمومی route
- `src/app/error.tsx`: error boundary با retry
- `src/app/not-found.tsx`: مسیر 404 بدون بن‌بست
- Empty stateهای commerce و account در خود صفحات
- Confirmation با `ConfirmDialog` و صفحه موفقیت Checkout
