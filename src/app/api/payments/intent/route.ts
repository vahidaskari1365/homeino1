import { getDb } from "@/db";
import { orders, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isString } from "@/lib/api/validate";
import { paymentGateway } from "@/services/payments";

export const runtime = "nodejs";

/**
 * Start a payment for an order (provider abstraction — the caller never names
 * a gateway). The concrete provider is chosen server-side by env config.
 */
export const POST = guard(async (req) => {
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, { orderId: isString(64) });

  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);
  if (!order || order.userId !== user.id) throw ApiError.notFound("سفارش یافت نشد");

  const gateway = paymentGateway();
  const intent = await gateway.createIntent({
    // DB amounts are TOMAN (currency:"IRT"); gateways settle in IRR (×10).
    amount: order.total * 10,
    currency: "IRR",
    orderId: order.id,
    // kind+orderId are what the webhook fulfillment path switches on —
    // without them paid orders stay pending forever.
    metadata: {
      kind: "order",
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: user.id,
    },
  });

  // record the payment row for reconciliation
  const [payment] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      userId: user.id,
      provider: intent.provider,
      providerPaymentId: intent.paymentId,
      amount: order.total,
      currency: order.currency,
      status: intent.status === "succeeded" ? "succeeded" : "pending",
    })
    .returning();

  return ok({ payment, providerFields: { clientSecret: intent.clientSecret, paymentUrl: intent.paymentUrl } });
});