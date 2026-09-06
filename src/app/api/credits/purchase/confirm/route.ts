import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isString } from "@/lib/api/validate";
import { DevPaymentProvider, paymentGateway } from "@/services/payments";
import { fulfillPaymentEvent } from "@/services/paymentFulfillment";

export const runtime = "nodejs";
/**
 * Demo-mode payment confirmation. Closes the purchase loop end-to-end:
 * intent (server) → confirm (this route, session-authorised) → the SAME
 * fulfillment path the real webhook uses. The paymentId must have been
 * issued by the server for THIS user with THIS pack — forged ids fail.
 * With a real gateway (STRIPE_SECRET_KEY set) this route is disabled and
 * the provider's webhook fulfills instead.
 */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) {
    throw new ApiError("PAYMENT_REQUIRED", "در حالت دمو، خرید اعتبار در مرورگر ثبت می‌شود.", 503);
  }
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, { paymentId: isString(64), pack: isString(40) });

  const gateway = paymentGateway();
  if (!(gateway instanceof DevPaymentProvider)) {
    throw ApiError.badRequest("با درگاه واقعی، تأیید پرداخت توسط وب‌هوک انجام می‌شود");
  }
  // Fulfill from the SERVER-ISSUED intent metadata (userId + kind only are
  // matched) — pack prices/credits may come from the DB and are NOT re-checked
  // against a fallback list here. Client echoes never decide the amount.
  const meta = gateway.consumeIntent(input.paymentId, { userId: user.id, kind: "credits" });
  if (!meta) {
    throw new ApiError("UNAUTHORIZED", "پرداخت یافت نشد یا متعلق به شما نیست", 403);
  }
  const credits = Number(meta.credits ?? 0);
  if (!Number.isInteger(credits) || credits <= 0) {
    throw ApiError.badRequest("بستهٔ اعتباری نامعتبر است");
  }

  const result = await fulfillPaymentEvent({
    provider: "dev",
    providerPaymentId: input.paymentId,
    eventType: "payment.succeeded",
    amount: 0, // ledger math uses credits, not the dev amount
    currency: "IRR",
    metadata: { kind: "credits", userId: user.id, credits },
    raw: { paymentId: input.paymentId },
  });
  if (!result.ok) throw ApiError.badRequest("تأیید پرداخت ناموفق بود");
  return ok({
    ok: true,
    duplicate: result.kind === "credits" && result.duplicate,
    credits,
  });
});
