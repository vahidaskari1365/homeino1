import { grantCredits } from "@/services/creditService";
import { updateOrderStatus } from "@/services/orderService";
import type { PaymentWebhookEvent } from "@/services/payments";

export type FulfillmentResult =
  | { ok: true; kind: "credits"; balanceAfter: number; duplicate: boolean }
  | { ok: true; kind: "order"; orderId: string; status: string }
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
  };

  if (event.eventType === "refund.succeeded") {
    if (!meta.orderId) return { ok: false, reason: "missing_order" };
    const order = await updateOrderStatus(meta.orderId, "refunded", `payment:${event.provider}`);
    return { ok: true, kind: "order", orderId: order.id, status: "refunded" };
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

  if (meta.kind === "order" && meta.orderId) {
    const order = await updateOrderStatus(meta.orderId, "confirmed", `payment:${event.provider}`);
    return { ok: true, kind: "order", orderId: order.id, status: order.status };
  }

  return { ok: false, reason: "unknown_event_kind" };
}
