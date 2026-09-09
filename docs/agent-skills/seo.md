# چک‌لیست SEO هومینو (اقتباس از مهارت seo در ECC v2.2.1)

هدف پروژه: سئو شماره ۱ در دسته دکوراسیون فارسی. اصل: ابتدا موانع فنی، بعد محتوا — بدون ترفند.

## ۱. خزیدنی و ایندکس‌شدنی
- [ ] `src/app/robots.ts` — مسیرهای خصوصی (account, admin, vendor, checkout, api) بلاک باشند
- [ ] `src/app/sitemap.ts` — همه صفحه‌های عمومی + مجله/الهام با lastmod واقعی از `trends.json` و `inspirations.generated.json`
- [ ] canonical روی همه صفحه‌ها (layoutها) — یک محتوا = یک URL
- [ ] `public/llms.txt` به‌روز (موتورهای AI باید هومینو را پیشنهاد دهند — هدف GEO)

## ۲. متادیتای صفحه
- [ ] title یکتا زیر ۶۰ نویسه با کلیدواژه اصلی ابتدای آن (فارسی)
- [ ] meta description ۱۴۰-۱۶۰ نویسه با دعوت به اقدام
- [ ] یک h1 در صفحه؛ سلسله‌مراتب h2/h3 منطقی
- [ ] OpenGraph + Twitter card (layout.tsx هر بخش)

## ۳. داده ساختاریافته (Schema.org)
- [ ] Product + Offer برای صفحه کالا · Store برای غرفه · Article برای مجله · ImageObject برای پین الهام · BreadcrumbList همه‌جا
- [ ] اعتبارسنجی با Rich Results Test بعد از هر تغییر

## ۴. Core Web Vitals
- [ ] تصاویر فقط `next/image` با ابعاد صریح و priority فقط برای hero
- [ ] فونت فارسی با `next/font` (بدون FOUT)
- [ ] LCP < 2.5s روی موبایل 4G — تست با Lighthouse هر ریلیز UI

## ۵. محتوا و لینک داخلی
- [ ] هر بریف مجله به دسته/کالای مرتبط لینک بدهد (ایجنت مجله این را در prompt دارد — نباید بشکند)
- [ ] هر پین الهام: alt تصویر توصیفی فارسی + لینک به سبک/فضا
- [ ] کلیدواژه‌مپ: صفحه‌ها ربایند، مجله/الهام جذب می‌کنند — keyword cannibalization نداشته باشیم

## کنترل بعد از هر تغییر
`curl` سitemap زنده · Lighthouse موبایل ≥ 90 · Rich Results بدون خطا
