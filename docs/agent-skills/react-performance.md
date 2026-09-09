# کارایی React/Next.js هومینو (اقتباس از react-performance و nextjs-turbopack در ECC v2.2.1)

## Server/Client boundary (مهم‌ترین اهرم)
- [ ] پیش‌فرض Server Component؛ `"use client"` فقط برای تعامل واقعی (استیت/ایونت)
- [ ] داده سنگین (گرید کالا، مجله) در سرور fetch شود — بدون waterfall کلاینت
- [ ] استورهای zustand (`src/stores/`) فقط state سراسری واقعی — state محلی در کامپوننت بماند

## تصویر و فونت (LCP)
- [ ] فقط `next/image` — ابعاد صریح؛ `priority` فقط hero صفحه؛ lazy بقیه
- [ ] فونت فارسی با `next/font/local` — subset و preload؛ بدون لینک CDN خارجی
- [ ] عکس‌های OSS ایجنت الهام از دامنه مجاز `next.config.ts` remotePatterns

## باندل
- [ ] کامپوننت‌های سنگین (اسلایدر استودیو، MaskCanvas، lightbox) با `next/dynamic` و loading skeleton
- [ ] import بارِل (`from "@/components"`) برای مسیرهای بزرگ ممنوع — import مستقیم از فایل
- [ ] کتابخانه جدید فقط با بهانه وزن: بررسی bundlephobia قبل از افزودن

## رندر و کش
- [ ] صفحه‌های عمومی (محصول، مجله، الهام) استاتیک یا ISR با revalidate معقول
- [ ] `generateMetadata` سبک باشد — کوئری سنگین داخل metadata تکرار نشود
- [ ] fetch تکراری همان داده در یک رندر با React `cache()` ادغام شود

## اندازه‌گیری قبل از ادعا
Lighthouse موبایل (perf ≥ 90) + `next build` → جدول route size. بدون عدد، «بهینه شد» معنا ندارد.
