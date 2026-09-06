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
 * می‌شود — همان روزنامه‌ای که هومینو را به «مرجع دیزاین خانه» تبدیل می‌کند.
 */
export interface TrendSource {
  /** نام منبع، مثلاً Architectural Digest */
  name: string;
  /** لینک مطلب اصلی منبع */
  url: string;
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
  /** یکی از: رنگ | مبلمان | آشپزخانه | حمام | متریال | سبک زندگی | سبک‌ها | هوشمند */
  category: string;
  /** کاور از /images/trends/ */
  cover: string;
  /** منبع اصلی روایت */
  source: TrendSource;
  /** منابع مکمل (اختیاری) */
  extraSources?: TrendSource[];
  /** زمان مطالعه به دقیقه */
  readTime: number;
  tags: string[];
}

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
