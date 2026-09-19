// ============================================================
// پکیج فروشنده (Task 58) — قرارداد نرخ مؤثر + فعال‌سازی idempotent
//
// نکتهٔ کلیدی: نرخ مؤثر کمیسیون «محاسبه‌شده» است، نه denormalize —
// پس انقضای اشتراک خودکار است و تاریخچهٔ snapshot صادقانه می‌ماند.
// ============================================================
import { describe, expect, it } from "vitest";
import {
  effectiveCommissionBp,
  proExpiryFor,
  proWindowStartFor,
  proIdempotencyKey,
  PRO_COMMISSION_BP,
  LIGHT_COMMISSION_BP,
  packageBySlug,
  VENDOR_PACKAGE_CATALOG,
} from "./vendorPackage";
import { PLATFORM } from "@/config/platform";
import { fulfillPaymentEvent } from "./paymentFulfillment";

const BASE_BP = PLATFORM.vendor.commissionRatePercent * 100; // ۹٪ طبق سیاست مالک

describe("effectiveCommissionBp — نرخ مؤثر", () => {
  it("حین اشتراک پلاس فعال، نرخ پکیج (۵٪) بر هر نرخ دیگری اولویت دارد", () => {
    expect(PRO_COMMISSION_BP).toBe(500);
    expect(effectiveCommissionBp(null, "pro-monthly")).toBe(500);
    expect(effectiveCommissionBp(300, "pro-monthly")).toBe(500); // حتی override ادمین
    expect(effectiveCommissionBp(BASE_BP, "pro-monthly")).toBe(500);
  });

  it("پکیج سبک (Task 59) → نرخ ۷٪ — بین پایهٔ ۹٪ و پلاسِ ۵٪", () => {
    expect(LIGHT_COMMISSION_BP).toBe(700);
    expect(effectiveCommissionBp(BASE_BP, PLATFORM.vendor.lightPackage.slug)).toBe(700);
    expect(effectiveCommissionBp(null, "light-monthly")).toBe(700);
  });

  it("کاتالوگ پکیج‌ها سازگار است — دو پله، slug یکتا، نرخ نزولی", () => {
    expect(VENDOR_PACKAGE_CATALOG).toHaveLength(2);
    const slugs = VENDOR_PACKAGE_CATALOG.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(packageBySlug("light-monthly").priceToman).toBe(990_000);
    expect(packageBySlug("pro-monthly").priceToman).toBe(2_280_000);
    // slug نامعتبر → پیش‌فرض محافظه‌کارانه: پلاس (هرگز نرخ اشتباه نمی‌دهد)
    expect(packageBySlug("bogus").slug).toBe("pro-monthly");
    expect(packageBySlug(null).slug).toBe("pro-monthly");
  });

  it("بدون اشتراک → نرخ per-vendor یا پیش‌فرض پلتفرم (۹٪)", () => {
    expect(effectiveCommissionBp(null, null)).toBe(BASE_BP);
    expect(effectiveCommissionBp(undefined, undefined)).toBe(BASE_BP);
    expect(effectiveCommissionBp(300, null)).toBe(300);
  });

  it("override نامعتبر بدون اشتراک → پیش‌فرض", () => {
    expect(effectiveCommissionBp(-1, null)).toBe(BASE_BP);
    expect(effectiveCommissionBp(10_001, null)).toBe(BASE_BP);
  });

  it("ریاضی صرفه‌جویی: روی ۱۰ میلیون فروش، ۴٪ اختلاف = ۴۰۰٬۰۰۰ تومان", () => {
    const saved = Math.round(10_000_000 * (BASE_BP - PRO_COMMISSION_BP) / 10_000);
    expect(saved).toBe(400_000);
  });

  it("نقطهٔ سربه‌سر = قیمت پکیج ÷ اختلاف کارمزد", () => {
    const breakeven = Math.round(
      PLATFORM.vendor.proPackage.priceToman /
        ((PLATFORM.vendor.commissionRatePercent - PLATFORM.vendor.proPackage.commissionRatePercent) / 100),
    );
    expect(breakeven).toBe(57_000_000);
  });

  it("سربه‌سر پکیج سبک: ۹۹۰٬۰۰۰ ÷ ۲٪ = ۴۹.۵ میلیون — پلهٔ ورود فروشندهٔ کوچک", () => {
    const breakeven = Math.round(
      PLATFORM.vendor.lightPackage.priceToman /
        ((PLATFORM.vendor.commissionRatePercent - PLATFORM.vendor.lightPackage.commissionRatePercent) / 100),
    );
    expect(breakeven).toBe(49_500_000);
  });
});

describe("پنجرهٔ تمدید — روزِ خریده‌شده هدر نمی‌رود", () => {
  const now = new Date("2026-09-19T10:00:00Z");

  it("بدون اشتراک فعال → از الان + ۳۰ روز", () => {
    const exp = proExpiryFor(now, null);
    expect(exp.getTime()).toBe(now.getTime() + 30 * 86_400_000);
  });

  it("مدت پلهٔ سبک هم ۳۰ روزه است (فقط قیمت/نرخ فرق دارد)", () => {
    const exp = proExpiryFor(now, null, PLATFORM.vendor.lightPackage.durationDays);
    expect(exp.getTime()).toBe(now.getTime() + 30 * 86_400_000);
  });

  it("با اشتراک فعال → از انقضای فعلی + ۳۰ روز (تمدید پشت‌سرهم)", () => {
    const activeUntil = new Date("2026-10-01T00:00:00Z");
    expect(proWindowStartFor(now, activeUntil)).toBe(activeUntil);
    const exp = proExpiryFor(now, activeUntil);
    expect(exp.getTime()).toBe(activeUntil.getTime() + 30 * 86_400_000);
  });

  it("اشتراک منقضی‌شده → از الان شروع می‌شود", () => {
    const expired = new Date("2026-09-01T00:00:00Z");
    expect(proWindowStartFor(now, expired)).toBe(now);
  });
});

describe("idempotency key", () => {
  it("هر پرداخت درگاه یک کلید یکتا", () => {
    expect(proIdempotencyKey("zarinpal", "A1")).toBe("vpro:zarinpal:A1");
    expect(proIdempotencyKey("dev", "X")).not.toBe(proIdempotencyKey("dev", "Y"));
  });
});

describe("fulfillment kind=vendor_package", () => {
  it("بدون userId متادیتا رد می‌شود (fail-closed — پیش از هر دسترسی به DB)", async () => {
    const result = await fulfillPaymentEvent({
      provider: "dev",
      providerPaymentId: "dev_pkg_1",
      eventType: "payment.succeeded",
      amount: 0,
      currency: "IRR",
      metadata: { kind: "vendor_package" },
      raw: {},
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_package_metadata" });
  });

  it("payment.failed هرگز فعال‌سازی نمی‌کند", async () => {
    const result = await fulfillPaymentEvent({
      provider: "dev",
      providerPaymentId: "dev_pkg_2",
      eventType: "payment.failed",
      amount: 0,
      currency: "IRR",
      metadata: { kind: "vendor_package", userId: "u1" },
      raw: {},
    });
    expect(result).toMatchObject({ ok: false, reason: "payment_failed" });
  });
});
