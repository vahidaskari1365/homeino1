import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payments, orders } from "@/db/schema";
import { ZarinpalProvider } from "@/services/payments";
import { fulfillPaymentEvent } from "@/services/paymentFulfillment";

export const runtime = "nodejs";

/**
 * Zarinpal redirect callback — the Iranian gateway's "webhook".
 *
 * Flow: buyer pays at Zarinpal → redirect here with ?Authority=…&Status=OK
 * plus the HMAC-signed metadata blob (d,s) the intent was created with.
 *
 * Auth is fail-closed, three layers:
 *   1. HMAC over the metadata blob (PAYMENTS_WEBHOOK_SECRET) — nothing forged.
 *   2. verify.json against Zarinpal with the DB-stored amount (never a client
 *      echo) — proves the money really moved.
 *   3. fulfillment is the shared idempotent path (no double credits/orders).
 *
 * After verification the buyer is redirected to a friendly page; retries
 * (code 101) are treated as success.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  const authority = url.searchParams.get("Authority") ?? url.searchParams.get("authority");
  const status = url.searchParams.get("Status") ?? url.searchParams.get("status");
  const d = url.searchParams.get("d");
  const s = url.searchParams.get("s");

  const failRedirect = (reason: string) =>
    NextResponse.redirect(`${origin}/account/orders?payment=failed&reason=${encodeURIComponent(reason)}`, 302);

  if (!authority || !d || !s) return failRedirect("missing_params");
  if (status && status.toUpperCase() !== "OK") return failRedirect("cancelled");

  let provider: ZarinpalProvider;
  try {
    provider = new ZarinpalProvider();
  } catch (err) {
    console.error("[zarinpal:callback] provider misconfigured:", err instanceof Error ? err.message : err);
    return failRedirect("gateway_config");
  }

  const meta = await provider.decodeCallback(d, s);
  if (!meta || typeof meta.amountToman !== "number" || !Number.isInteger(meta.amountToman) || meta.amountToman <= 0) {
    return failRedirect("bad_signature");
  }

  // Re-check against Zarinpal itself — this is what actually proves payment.
  const verified = await provider.verify(authority, meta.amountToman);
  if (!verified.ok) return failRedirect("verify_failed");

  // Keep the payments row in sync (order payments have a row; credits don't).
  try {
    const db = getDb();
    await db
      .update(payments)
      .set({ status: "succeeded", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(payments.provider, "zarinpal"), eq(payments.providerPaymentId, authority), eq(payments.status, "pending")));
  } catch (err) {
    console.warn("[zarinpal:callback] payments row sync skipped:", err instanceof Error ? err.message : err);
  }

  const result = await fulfillPaymentEvent({
    provider: "zarinpal",
    providerPaymentId: authority,
    eventType: "payment.succeeded",
    amount: meta.amountToman,
    currency: "IRT",
    metadata: meta,
    raw: { authority, ...meta },
  });

  if (!result.ok) {
    console.error("[zarinpal:callback] fulfillment failed:", result.reason);
    return failRedirect(result.reason);
  }

  if (result.kind === "order") {
    const orderNumber = await getOrderNumber(result.orderId).catch(() => null);
    return NextResponse.redirect(`${origin}/account/orders?payment=success&order=${encodeURIComponent(orderNumber ?? result.orderId)}&ref=${verified.refId ?? ""}`, 302);
  }
  return NextResponse.redirect(`${origin}/account/credits?payment=success&ref=${verified.refId ?? ""}`, 302);
}

async function getOrderNumber(orderId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db.select({ n: orders.orderNumber }).from(orders).where(eq(orders.id, orderId)).limit(1);
  return row?.n ?? null;
}
