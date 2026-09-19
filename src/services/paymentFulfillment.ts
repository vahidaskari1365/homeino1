import { grantCredits } from "@/services/creditService";
import { recordCouponRedemption } from "@/services/coupons";
import { updateOrderStatus } from "@/services/orderService";
import { accrueOrderEarnings, reverseOrderEarnings } from "@/services/vendorSettlement";
import { activateVendorPackage } from "@/services/vendorPackage";
import type { PaymentWebhookEvent } from "@/services/payments";

export type FulfillmentResult =
  | { ok: true; kind: "credits"; balanceAfter: number; duplicate: boolean }
  | { ok: true; kind: "order"; orderId: string; status: string }
  | { ok: true; kind: "vendor_package"; vendorId: string; expiresAt: string; duplicate: boolean }
  | { ok: false; reason: string };

/**
 * THE single fulfillment path for successful payments. The webhook route and
 * the dev confirm route both funnel through here, so credits can never be
 * granted twice: the ledger's idempotency key is derived from the provider
 * payment id.
 */
export async function fulfillPaymentEvent(event: PaymentWebhookEvent): Promise<FulfillmentResult> {
  if (event.eventType === "payment.failed") {
    return { ok: false, reason: "payment_failed" };
  }
  const meta = (event.metadata ?? {}) as {
    kind?: string;
    userId?: string;
    credits?: number;
    orderId?: string;
    vendorId?: string;
    amountToman?: number;
    couponCode?: string;
    couponId?: string;
    amountOffIrr?: number;
  };

  if (event.eventType === "refund.succeeded") {
    if (!meta.orderId) return { ok: false, reason: "missing_order" };
    const order = await updateOrderStatus(meta.orderId, "refunded", `payment:${event.provider}`);
    // Void the vendors' unpaid commission rows too (fail-safe — a settlement
    // problem must never break the buyer's refund flow).
    await reverseOrderEarnings(meta.orderId).catch((err) =>
      console.warn("[fulfillment] earnings reversal skipped:", err instanceof Error ? err.message : err),
    );
    return { ok: true, kind: "order", orderId: order.id, status: "refunded" };
  }

  // Referral qualification: the invitee's FIRST successful payment (credits
  // OR order) releases both referral bonuses. Fail-safe by design.
  if (meta.userId) {
    try {
      const { qualifyReferral } = await import("@/services/gamification");
      await qualifyReferral(meta.userId);
    } catch (err) {
      console.warn("[fulfillment] referral qualification skipped:", err instanceof Error ? err.message : err);
    }
  }

  // payment.succeeded
  if (meta.kind === "credits") {
    if (!meta.userId || !Number.isInteger(meta.credits) || (meta.credits ?? 0) <= 0) {
      return { ok: false, reason: "invalid_credit_metadata" };
    }
    try {
      const res = await grantCredits(meta.userId, meta.credits!, {
        type: "purchase",
        operation: "credits:purchase",
        referenceType: "payment",
        referenceId: event.providerPaymentId,
        idempotencyKey: `pay:${event.provider}:${event.providerPaymentId}`,
        note: `خرید اعتبار (${event.provider})`,
      });
      // Record the coupon redemption AFTER the grant succeeded. Idempotent
      // per (coupon, paymentRef); a failure here must NEVER block credits,
      // so it is logged and swallowed.
      if (meta.couponCode && meta.couponId) {
        try {
          await recordCouponRedemption({
            couponId: meta.couponId,
            userId: meta.userId,
            paymentRef: `${event.provider}:${event.providerPaymentId}`,
            amountOffIrr: Number(meta.amountOffIrr ?? 0),
          });
        } catch (err) {
          console.warn(
            "[fulfillment] coupon redemption not recorded:",
            err instanceof Error ? err.message : err,
          );
        }
      }
      return { ok: true, kind: "credits", balanceAfter: res.balanceAfter, duplicate: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate key") || msg.includes("unique")) {
        // Already fulfilled — this is the webhook retry case, not an error.
        return { ok: true, kind: "credits", balanceAfter: -1, duplicate: true };
      }
      throw err;
    }
  }

  if (meta.kind === "vendor_package") {
    if (!meta.userId) return { ok: false, reason: "invalid_package_metadata" };
    try {
      const res = await activateVendorPackage({
        userId: meta.userId,
        provider: event.provider,
        providerPaymentId: event.providerPaymentId,
        priceToman: Number(meta.amountToman ?? 0) || undefined,
      });
      return {
        ok: true,
        kind: "vendor_package",
        vendorId: res.vendorId,
        expiresAt: res.expiresAt.toISOString(),
        duplicate: res.duplicate,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate key") || msg.includes("unique")) {
        return { ok: true, kind: "vendor_package", vendorId: meta.vendorId ?? "", expiresAt: "", duplicate: true };
      }
      throw err;
    }
  }

  if (meta.kind === "order" && meta.orderId) {
    const order = await updateOrderStatus(meta.orderId, "confirmed", `payment:${event.provider}`);
    // Marketplace settlement: create the per-item commission ledger rows.
    // Idempotent (unique per order item) + fail-safe — a settlement failure
    // must never invalidate a successful payment.
    await accrueOrderEarnings(order.id).catch((err) =>
      console.warn("[fulfillment] earnings accrual skipped:", err instanceof Error ? err.message : err),
    );
    return { ok: true, kind: "order", orderId: order.id, status: order.status };
  }

  return { ok: false, reason: "unknown_event_kind" };
}
