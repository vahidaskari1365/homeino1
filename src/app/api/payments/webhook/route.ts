import { NextResponse } from "next/server";
import { paymentGateway } from "@/services/payments";
import { fulfillPaymentEvent } from "@/services/paymentFulfillment";

export const runtime = "nodejs";

/**
 * Payment provider webhook — the ONLY place where successful payments turn
 * into credits/order confirmations. Authenticity comes from the provider's
 * signature over the RAW body (never from client-supplied fields).
 * This route is intentionally public: the signature IS the auth.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "JSON نامعتبر" } }, { status: 400 });
    }
    const signature =
      req.headers.get("x-homeino-signature") ??
      req.headers.get("stripe-signature") ??
      undefined;
    const event = await paymentGateway().parseWebhook(body, signature);
    const result = await fulfillPaymentEvent(event);
    if (!result.ok) {
      // 200 with ok:false — providers retry on 5xx; a deterministic refusal
      // should not trigger endless retries.
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
    }
    return NextResponse.json({ ok: true, received: true });
  } catch (err) {
    // Signature/payload failures: 400 (do not leak internals).
    const msg = err instanceof Error ? err.message : "webhook error";
    const isAuth = msg.includes("signature") || msg.includes("payload");
    console.error("[payments:webhook]", msg);
    return NextResponse.json(
      { ok: false, error: { code: isAuth ? "UNAUTHORIZED" : "INTERNAL", message: isAuth ? "امضای وب‌هوک نامعتبر است" : "خطای داخلی" } },
      { status: isAuth ? 400 : 500 },
    );
  }
}
