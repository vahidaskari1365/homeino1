import { PLATFORM } from "@/config/platform";

/**
 * Single source of truth for shipping math (Toman). Used by cart/sync,
 * order creation and the checkout UI so the displayed total, the stored
 * order total and the charged amount can never drift apart.
 */
export type ShippingMethod = "post" | "express";

export const FREE_SHIPPING_THRESHOLD = PLATFORM.policies.freeShippingThreshold;
export const SHIPPING_POST_PER_PARCEL = 120_000; // per vendor parcel
export const SHIPPING_EXPRESS_PER_PARCEL = 250_000;

export function isShippingMethod(v: unknown): v is ShippingMethod {
  return v === "post" || v === "express";
}

/** Per-vendor-parcel shipping for a subtotal (Toman). */
export function shippingForSubtotal(subtotal: number, method: ShippingMethod): number {
  if (method === "express") return SHIPPING_EXPRESS_PER_PARCEL;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_POST_PER_PARCEL;
}

export function shippingTotal(vendorCount: number, subtotal: number, method: ShippingMethod): number {
  if (vendorCount <= 0) return 0;
  return vendorCount * shippingForSubtotal(subtotal, method);
}
