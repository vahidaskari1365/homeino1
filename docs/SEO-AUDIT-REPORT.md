# Homeino — بازبینی SEO بر اساس Claude SEO Skill

- **تاریخ:** ۲۰۲۶-۰۹-۰۳
- **چک‌اوت:** `arena/01a065d7-homeino1`
- **Skill:** [Claude SEO](https://github.com/AgriciDaniel/claude-seo) نسخه `v2.2.5`
- **محل نصب:** `~/.claude/skills/seo/` (Core runtime نصب شد؛ Chromium جداگانه قابل نصب است)
- **منبع مرجع:** `skills/seo-audit/`, `skills/seo-schema/`, `skills/seo-technical/`

## خلاصه

سایت با معیارهای `seo-audit`، `seo-schema`، `seo-sitemap` و `seo-geo` بازبینی شد.
تغییرات این راند **بیرنگ (SEO/متادیتا/اکسترا) بود** به‌جز سه موردی که خودتان درخواست کردید:
جمله Hero، ظاهر منوی بالا و فعال‌سازی فونت فارسی استاندارد.

## مشکلات پیدا شده و اقدام‌های انجام‌شده

| دسته | وضعیت | اقدام |
| --- | --- | --- |
| Schema / Product | نبود JSON-LD در HTML اولیه | افزودن `Product + Offer + AggregateRating + BreadcrumbList` در `products/[slug]/layout.tsx` |
| Schema / Store | نبود JSON-LD | افزودن `Store + AggregateRating + BreadcrumbList` در `stores/[slug]/layout.tsx` |
| Schema / Article | نبود JSON-LD | افزودن `Article + BreadcrumbList` در `magazine/[slug]/layout.tsx` |
| Schema / Breadcrumb | فقط در UI | افزودن `BreadcrumbList` به دسته‌بندی‌ها، سبک‌ها و الهام‌ها |
| قیمت Schema | ناسازگاری واحد `IRR` | تبدیل قیمت‌ها از تومان به ریال در `productJsonLd` |
| تاریخ Schema | فرمت غیر ISO | تبدیل تاریخ‌های فارسی به ISO در `articleJsonLd` |
| Sitemap | شامل صفحات noindex و ریدایرکت `/ai` | حذف `/compare`، `/wishlist`، `/collections`، `/login`، `/register`، `/forgot-password` و `/ai`؛ افزودن `/ai/design` |
| robots.ts | مسیرهای کاربری بلاک نبودند | افزودن `compare/wishlist/collections/login/register/forgot-password` |
| Canonical AI | pointing به `/ai` | تغییر به `/ai/design` |
| Font | `@fontsource-variable/vazirmatn` نصب ولی لود نبود | ایمپورت فونت و اصلاح نام `Vazirmatn Variable` در Tailwind |
| AI Search Readiness | غیبت `llms.txt` | ساخت `public/llms.txt` |
| Metadata | عنوان/توضیحات/OG/Twitter قدیمی | به‌روزرسانی Root metadata با پیام جدید Hero |
| Resource Hints | هیچ | افزودن `preconnect/dns-prefetch` به `images.pexels.com` |
| Header | منوی بالایی ساده و بدون حالت فعال | بازطراحی ظریف با آیکون، حالت فعال، آندرلاین طلایی، هوور و نشانگر برای AI |

## تغییرات ظاهری (فقط مورد درخواستی)

1. **Hero** — بعد از پایان ویدیو نمایش داده می‌شود:

   > خانه‌ ایی که شبیه توست ، همین جا آغاز می شود

   زیر آن:

   > سبک خودت رو را انتخاب کن و خانه رویایی ات رو بساز

2. **منوی بالا** — ظاهر مدرن‌تر، آیکون‌دار، با تشخیص صفحه فعال، هوور و افکت طلایی برای AI Studio.

3. **فونت فارسی** — Vazirmatn Variable (استاندارد متن‌باز سایت‌های فارسی) روی کل سایت فعال شد.

## اجرای مجدد Skill

```bash
# پس از نصب کامل کروم
~/.claude/skills/seo/bin/claude-seo setup

# تحلیل مجدد سایت
~/.claude/skills/seo/bin/claude-seo run render_page.py https://homeino.ir --mode auto --json
~/.claude/skills/seo/bin/claude-seo run pagespeed_check.py https://homeino.ir --json
```

## محدودیت

- Google Search Console / CrUX / DataForSEO به دلیل نبود credentials در این محیط اجرا نشد.
- Chromium در این سندباکس نصب نشد؛ نسخه‌های سرو کامل (و نه کاربردی) با `setup` نصب می‌شود.
- ظاهر سایت عمداً تغییر نکرد؛ فقط موارد درخواستی کاربر اعمال شد.
