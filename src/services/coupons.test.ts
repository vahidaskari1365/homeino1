import { describe, expect, it } from "vitest";
import {
  normalizeCouponCode,
  couponDiscountIrr,
  couponFinalIrr,
} from "./coupons";

describe("normalizeCouponCode", () => {
  it("uppercases and strips spaces / zero-width chars", () => {
    expect(normalizeCouponCode("  launch 20 ")).toBe("LAUNCH20");
    expect(normalizeCouponCode("homi\u200c20")).toBe("HOMI20");
  });

  it("converts Persian digits to latin", () => {
    expect(normalizeCouponCode("کد۲۰")).toBe("کد20");
  });
});

describe("couponDiscountIrr", () => {
  it("computes the discount portion with half-up rounding", () => {
    expect(couponDiscountIrr(1_000_000, 20)).toBe(200_000);
    expect(couponDiscountIrr(999_999, 20)).toBe(200_000); // 199999.8 → 200000
    expect(couponDiscountIrr(2_200_000, 20)).toBe(440_000);
  });

  it("clamps invalid percents and prices", () => {
    expect(couponDiscountIrr(1_000_000, 0)).toBe(0);
    expect(couponDiscountIrr(1_000_000, 150)).toBe(1_000_000);
    expect(couponDiscountIrr(-5, 20)).toBe(0);
    expect(couponDiscountIrr(NaN, 20)).toBe(0);
  });
});

describe("couponFinalIrr", () => {
  it("never returns less than 1 IRR", () => {
    expect(couponFinalIrr(1_000, 100)).toBe(1);
    expect(couponFinalIrr(5_000_000, 20)).toBe(4_000_000);
  });
});
