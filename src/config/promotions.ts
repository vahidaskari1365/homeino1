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
