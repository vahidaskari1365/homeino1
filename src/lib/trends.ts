import raw from "@/content/trends/trends.json";

/**
 * مرجع ترند هومینو — داده‌های «ترندهای روز»
 *
 * هر آیتم یک «بریف ترند» است: خلاصه‌ای اختصاصی و بازنویسی‌شده به فارسی از
 * مهم‌ترین روایت‌های دیزاین داخلی در منابع معتبر جهانی (Architectural Digest،
 * Dezeen، Vogue، Veranda، ELLE Decor و …). محتوا هرگز ترجمه یا کپی verbatim
 * نیست؛ واقعیت‌ها گردآوری و به‌صورت مستقل برای مخاطب ایرانی بازنویسی می‌شوند
 * و منبع اصلی با لینک ذکر می‌شود.
 *
 * فایل src/content/trends/trends.json توسط اسکریپت روزانه
 * `npm run magazine:daily` (اسکریپت scripts/magazine-daily.mjs) به‌روزرسانی
 * می‌شود — روزی ۳ نوبت سرچ، با پوشش کامل دسته‌های محصول سایت.
 */
export interface TrendSource {
  /** نام منبع، مثلاً Architectural Digest */
  name: string;
  /** لینک مطلب اصلی منبع */
  url: string;
}

/** پرسش‌وپاسخ اختصاصی هر بریف — پایه FAQPage JSON-LD و قابلیت استناد هوش مصنوعی‌ها (GEO) */
export interface TrendFaqItem {
  q: string;
  a: string;
}

export interface TrendBrief {
  /** شناسه یکتا — برای لنگر صفحه: /trends/{date}#{slug} */
  slug: string;
  /** تاریخ میلادی ISO — 2026-09-06 */
  date: string;
  /** تاریخ نمایشی شمسی — ۱۴۰۵/۰۶/۱۵ */
  dateFa: string;
  title: string;
  /** متن اصلی بریف؛ بازنویسی اختصاصی فارسی (۱۱۰ تا ۱۷۰ واژه) */
  summary: string;
  /** جمع‌بندی کاربردی برای خانه‌های ایرانی */
  takeaway: string;
  /** یکی از برچسب‌های TREND_CATEGORY_META (هم‌راستا با CATEGORIES_FA ایجنت مجله) */
  category: string;
  /** کاور (از منبع، عکس هم‌موضوع یا استخر کاور اختصاصی هومینو) */
  cover: string;
  /** منبع اصلی روایت */
  source: TrendSource;
  /** منابع مکمل (اختیاری) */
  extraSources?: TrendSource[];
  /** زمان مطالعه به دقیقه */
  readTime: number;
  tags: string[];
  /** عبارت‌های جستجوی هدف (۳-۴ عبارت فارسی که مخاطب واقعاً جست‌وجو می‌کند) */
  keywords?: string[];
  /** دو پرسش‌وپاسخ اختصاصی بریف — اختیاری؛ بریف‌های ایجنت روزانه مقداردهی می‌شوند */
  faq?: TrendFaqItem[];
}

/**
 * متادیتای دسته‌های محتوایی «ترندها» — عیناً همان CATEGORIES_FA ایجنت مجله
 * (scripts/magazine-daily.mjs → برگرفته از scripts/lib/homeino-categories.mjs).
 * دسته‌های دارای productSlug هاب‌های دنباله‌دار (کلستر سئو) با صفحه‌ی دسته‌ی
 * محصول می‌سازند: /trends/category/{slug} ↔ /category/{productSlug}
 */
export interface TrendCategoryMeta {
  /** برچسب فارسی — همان مقدار category در بریف‌ها */
  label: string;
  /** اسلاگ لاتین هاب: /trends/category/{slug} */
  slug: string;
  /** اسلاگ دسته‌بندی محصول متناظر (اختیاری — برای دسته‌های صرفاً تحریریه‌ای نیست) */
  productSlug?: string;
  /** توضیح سئوی هاب */
  description?: string;
}

export const TREND_CATEGORY_META: TrendCategoryMeta[] = [
  // ---------- ۱۰ دسته محصول سایت (مطابق دستور کاربر: فرش، روشنایی، تابلو، گلدان، پرده، کمد، کف‌پوش، دیوارپوش، …) ----------
  { label: "مبلمان", slug: "furniture", productSlug: "furniture", description: "ترندهای روز مبل، کاناپه، صندلی و میز — بازنویسی اختصاصی هومینو از معتبرترین منابع جهانی دیزاین." },
  { label: "فرش و قالیچه", slug: "rugs", productSlug: "rugs", description: "ترندهای روز فرش و قالیچه — از نقش‌های دستباف ایرانی تا راگ‌های مدرن جهانی." },
  { label: "کف‌پوش", slug: "flooring", productSlug: "rugs", description: "ترندهای روز کف‌پوش: پارکت، لمینت، ترازو و کف‌پوش‌های چوبی مدرن." },
  { label: "روشنایی و لوستر", slug: "lighting", productSlug: "lighting", description: "ترندهای روز لوستر، آباژور، چراغ آویز و دیواری — راهنمای نورپردازی خانه." },
  { label: "تابلو و دیوارکوب", slug: "wall-art", productSlug: "decor", description: "ترندهای روز تابلو، گالری‌وال و دیوارکوب — دیوارهای خانه به روایت منابع جهانی." },
  { label: "گلدان و گیاه", slug: "vase-plant", productSlug: "decor", description: "ترندهای روز گلدان، گیاهان آپارتمانی و سبزینگی در دکور خانه." },
  { label: "پرده و منسوجات", slug: "textiles", productSlug: "textiles", description: "ترندهای روز پرده، کوسن، پتو و رومیزی — منسوجات خانه به روایت منابع جهانی." },
  { label: "دکوری و اکسسوری", slug: "decor-accessories", productSlug: "decor", description: "ترندهای روز دکوری، آینه، شمع و استایلینگ قفسه — جزئیاتی که خانه را تمام می‌کند." },
  { label: "کمد و ذخیره‌سازی", slug: "storage", productSlug: "bedroom", description: "ترندهای روز کمد، کمددیواری و راهکارهای ذخیره‌سازی هوشمند خانه." },
  { label: "دیوارپوش", slug: "wallpaper", description: "ترندهای روز دیوارپوش و کاغذدیواری: وال‌پنل، موج و بافت‌های سه‌بعدی." },
  // ---------- دسته‌های تحریریه‌ای ----------
  { label: "رنگ", slug: "color", description: "رنگ سال، پالت‌های پیشنهادی و ترندهای رنگ‌آمیزی دیوار از معتبرترین منابع جهانی." },
  { label: "آشپزخانه", slug: "kitchen", productSlug: "kitchen", description: "ترندهای روز آشپزخانه، ظروف و لوازم آشپزخانه — بازنویسی اختصاصی برای خانه ایرانی." },
  { label: "حمام", slug: "bathroom", description: "ترندهای روز سرویس بهداشتی و حمام — از وت‌روم تا کابینت و روشنایی." },
  { label: "متریال", slug: "materials", description: "ترندهای متریال خانه: چوب، سنگ، مرمر، برنج و ترکیب‌های ماندگار." },
  { label: "سبک زندگی", slug: "lifestyle", description: "ترندهای زندگی‌داری و چیدمان خانه‌های کوچک و بزرگ — راهنماهای کاربردی هومینو." },
  { label: "سبک‌ها", slug: "styles", description: "راهنمای سبک‌های طراحی داخلی: جاپندی، مینیمال، آرت‌دکو، بوهو و بیش از این‌ها." },
  { label: "هوشمند", slug: "smart-home", description: "ترندهای خانه هوشمند و گجت‌های دکوراتیو — تکنولوژی در خدمت زیبایی خانه." },
  { label: "ویلا و باغ", slug: "villa-garden", productSlug: "outdoor", description: "ترندهای روز ویلا، خانه‌های تعطیلات و طراحی باغ — زندگی بیرونی لوکس." },
  { label: "حیاط و بیرونی", slug: "outdoor", productSlug: "outdoor", description: "ترندهای روز بالکن، حیاط و مبلمان فضای باز — زندگی بیرونی برای خانه‌های ایرانی." },
  { label: "محیط کار", slug: "workspace", productSlug: "workspace", description: "ترندهای روز میز کار، صندلی اداری و میزبانی فضای کار در خانه." },
  { label: "وسایل ترند", slug: "trend-pieces", description: "قطعات شاخص و کلکسیونی: مبل منحنی، وینتیج و اشیای امضادار فصل." },
];

const data = raw as unknown as { briefs: TrendBrief[] };

/** همه بریف‌ها — جدیدترین اول */
export const trendBriefs: TrendBrief[] = data.briefs;

/** تاریخ‌های موجود (یکتا، نزولی) */
export const trendDates: string[] = [...new Set(trendBriefs.map((b) => b.date))].sort().reverse();

/** بریف‌های یک روز مشخص */
export function briefsByDate(date: string): TrendBrief[] {
  return trendBriefs.filter((b) => b.date === date);
}

/** آخرین روز انتشار */
export function latestTrendDate(): string | undefined {
  return trendDates[0];
}

/** n بریف آخر (برای نوار صفحه اصلی) */
export function latestTrendBriefs(limit = 3): TrendBrief[] {
  return trendBriefs.slice(0, limit);
}

/** دسته‌بندی‌های موجود در داده */
export const trendCategories: string[] = [...new Set(trendBriefs.map((b) => b.category))];

/** بریف‌های یک دسته‌ی محتوایی */
export function briefsByCategory(label: string): TrendBrief[] {
  return trendBriefs.filter((b) => b.category === label);
}

/** متادیتای یک دسته بر اساس برچسب فارسی */
export function trendCategoryByLabel(label: string): TrendCategoryMeta | undefined {
  return TREND_CATEGORY_META.find((m) => m.label === label);
}

/** متادیتای یک دسته بر اساس اسلاگ لاتین هاب */
export function trendCategoryBySlug(slug: string): TrendCategoryMeta | undefined {
  return TREND_CATEGORY_META.find((m) => m.slug === slug);
}

/**
 * هاب‌های دسته‌ای با حداقل یک بریف — برای صفحات /trends/category/{slug}،
 * sitemap و چیپ‌های فیلتر. پربریف‌ترین دسته اول.
 */
export const trendCategoryList: { meta: TrendCategoryMeta; count: number; latest: string }[] =
  TREND_CATEGORY_META.map((meta) => {
    const list = briefsByCategory(meta.label);
    return { meta, count: list.length, latest: list[0]?.date ?? "" };
  })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
