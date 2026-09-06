import { describe, expect, it } from "vitest";
import { shippingForSubtotal, shippingTotal, isShippingMethod } from "./shipping";

describe("shipping math (Toman, per vendor parcel)", () => {
  it("charges post shipping below the free threshold", () => {
    expect(shippingForSubtotal(1_000_000, "post")).toBe(120_000);
  });

  it("waives post shipping at/above the free threshold", () => {
    expect(shippingForSubtotal(5_000_000, "post")).toBe(0);
    expect(shippingForSubtotal(6_500_000, "post")).toBe(0);
  });

  it("never waives express shipping", () => {
    expect(shippingForSubtotal(99_000_000, "express")).toBe(250_000);
  });

  it("multiplies by vendor count and returns 0 for an empty cart", () => {
    expect(shippingTotal(3, 900_000, "post")).toBe(360_000);
    expect(shippingTotal(0, 900_000, "express")).toBe(0);
  });

  it("validates the shipping method", () => {
    expect(isShippingMethod("post")).toBe(true);
    expect(isShippingMethod("express")).toBe(true);
    expect(isShippingMethod("drone")).toBe(false);
  });
});
