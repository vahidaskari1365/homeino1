import { describe, expect, it } from "vitest";
import type { CartItem } from "@/types";
import { resolveCartLines, groupCartParcels } from "@/lib/marketplace";
import { placeLocalOrder } from "./localOrders";

// p1 (st1) is above the free-shipping threshold; p15 (st5) is below it.
const items: CartItem[] = [
  { productId: "p1", qty: 1 },
  { productId: "p1", qty: 1 },
  { productId: "p15", qty: 2 },
];

describe("placeLocalOrder", () => {
  it("records per-parcel shipping matching groupCartParcels for standard post", () => {
    const order = placeLocalOrder(items, false);
    const expectedParcels = groupCartParcels(resolveCartLines(items), false);

    expect(order.parcels).toHaveLength(expectedParcels.length);
    order.parcels.forEach((parcel, index) => {
      const expected = expectedParcels[index];
      expect(parcel.storeId).toBe(expected.storeId);
      expect(parcel.shippingCost).toBe(expected.shippingCost);
    });

    expect(order.total).toBe(expectedParcels.reduce((sum, p) => sum + p.total, 0));
  });

  it("records per-parcel shipping matching groupCartParcels for express post", () => {
    const order = placeLocalOrder(items, true);
    const expectedParcels = groupCartParcels(resolveCartLines(items), true);

    expect(order.parcels).toHaveLength(expectedParcels.length);
    order.parcels.forEach((parcel, index) => {
      const expected = expectedParcels[index];
      expect(parcel.storeId).toBe(expected.storeId);
      expect(parcel.shippingCost).toBe(expected.shippingCost);
    });

    expect(order.total).toBe(expectedParcels.reduce((sum, p) => sum + p.total, 0));
  });

  it("charges express cost even for a parcel that would be free on standard", () => {
    const standard = placeLocalOrder([{ productId: "p1", qty: 1 }], false);
    const express = placeLocalOrder([{ productId: "p1", qty: 1 }], true);

    expect(standard.total).toBeGreaterThan(0);
    expect(standard.parcels[0].shippingCost).toBe(0); // free shipping threshold reached
    expect(express.parcels[0].shippingCost).toBe(250_000); // express is never free
    expect(express.total).toBe(standard.total + 250_000);
  });

  it("generates a unique id that does not collide with seed orders", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const order = placeLocalOrder([{ productId: "p15", qty: 1 }], false);
      expect(order.id.length).toBeGreaterThan(0);
      expect(seen.has(order.id)).toBe(false);
      seen.add(order.id);
    }
  });
});
