// ============================================================
// PROMOTIONS CONFIG — single source of truth for growth campaigns.
// The AUTHORITATIVE coupon window/limits live in the `coupons` DB
// table (seeded by migration 202609190001). This config only holds
// what the UI + services need to stay in sync with that row.
// ============================================================

/** Signup welcome gift — granted once per user, expires after `hours`. */
export const WELCOME_GIFT = {
  credits: 5,
  hours: 48,
  note: "هدیهٔ خوش‌آمد هومینو استودیو",
} as const;

/** Launch campaign — must match the seeded `coupons` row (code LAUNCH20). */
export const LAUNCH_CAMPAIGN = {
  code: "LAUNCH20",
  percentOff: 20,
  maxRedemptions: 50,
  label: "کمپین راه‌اندازی هومینو",
} as const;

/** Copy-to-clipboard feedback label. */
export const COPIED_HINT = "کد کپی شد!";

/* ============================================================
 * GAMIFICATION (فاز ۳ — سبک Temu اما صادقانه)
 * قواعد سخت: هر جایزه از creditService واقعی می‌آید؛ احتمال‌ها
 * همین‌جا منتشر شده و در UI نشان داده می‌شود («شانس واقعی»).
 * ============================================================ */

/** Daily spin-the-wheel — one free spin per Tehran-day, always wins credits. */
export const DAILY_SPIN = {
  /** weight + credits + نمایش سگمنت چرخ. جمع وزن‌ها = ۱۰۰۰. */
  segments: [
    { key: "c3", credits: 3, weight: 400, label: "۳ اعتبار", color: "#e7e0d6" },
    { key: "c5", credits: 5, weight: 250, label: "۵ اعتبار", color: "#f3d9c8" },
    { key: "c10", credits: 10, weight: 150, label: "۱۰ اعتبار", color: "#d8e3d5" },
    { key: "c15", credits: 15, weight: 100, label: "۱۵ اعتبار", color: "#f0e3c0" },
    { key: "c20", credits: 20, weight: 70, label: "۲۰ اعتبار", color: "#e3d3ef" },
    { key: "c50", credits: 50, weight: 30, label: "۵۰ اعتبار", color: "#f5cfcf" },
  ],
  /** برچسب صادقانه که در UI کنار چرخ نشان داده می‌شود. */
  oddsLabel: "شانس‌ها واقعی‌اند: ۴۰٪ برندهٔ ۳ · ۲۵٪ برندهٔ ۵ · ۱۵٪ برندهٔ ۱۰ · ۱۰٪ برندهٔ ۱۵ · ۷٪ برندهٔ ۲۰ · ۳٪ برندهٔ ۵۰",
} as const;

/** Daily check-in streak — escalating credits, reset after a missed day. */
export const DAILY_STREAK = {
  /** day → credits (بیش از این سقف، هفتگی تکرار می‌شود) */
  rewards: { 1: 2, 2: 3, 3: 5, 4: 5, 5: 8, 6: 8, 7: 15 } as Record<number, number>,
  /** از روز ۸ به بعد، هر هفته کامل = ۱۵ */
  weeklyReward: 15,
} as const;

/** Badge catalog — keys match gamification_badges.badge_key. */
export const BADGES = [
  { key: "first_design", title: "اولین طراحی", description: "اولین طراحی AIات را completing کردی", icon: "sparkles" },
  { key: "designer_10", title: "طراح پرکار", description: "۱۰ طراحی AI ساختی", icon: "wand" },
  { key: "first_purchase", title: "خرید اول", description: "اولین خریدت را انجام دادی", icon: "bag" },
  { key: "streak_7", title: "هفتهٔ کامل", description: "۷ روز پیوسته وارد شدی", icon: "flame" },
  { key: "referrer", title: "سفیر هومینو", description: "یک دوست را با موفقیت دعوت کردی", icon: "users" },
  { key: "spinner", title: "خوش‌شانس", description: "اولین چرخ شانست را زدی", icon: "gift" },
] as const;

export type BadgeKey = (typeof BADGES)[number]["key"];
