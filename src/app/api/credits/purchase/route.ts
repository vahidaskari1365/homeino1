import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { paymentGateway } from "@/services/payments";

export const runtime = "nodejs";

const PACKS: Record<string, { credits: number; amount: number }> = {
  starter: { credits: 50, amount: 100_000 },
  popular: { credits: 120, amount: 220_000 },
  pro: { credits: 300, amount: 500_000 },
};

/**
 * Purchase flow: create a payment intent for a credit pack; on successful
 * payment the webhook grants credits. The pack price lives on the SERVER,
 * never in a client request.
 */
export const POST = guard(async (req) => {
  const { user } = await requireUser(req);
  const key = req.nextUrl.searchParams.get("pack") ?? "popular";
  const pack = PACKS[key];
  if (!pack) throw ApiError.badRequest("بسته اعتباری نامعتبر است");

  const gateway = paymentGateway();
  const intent = await gateway.createIntent({
    amount: pack.amount,
    // TODO(launch): pack.amount values are Toman (تومان) but currency is "IRR".
    // 1 Toman = 10 Rials. Convert amount * 10 (or switch the currency code)
    // before going live with a real Iranian/Stripe gateway.
    currency: "IRR",
    orderId: `credits-${user.id}`,
    description: `کیفیت اعتبار ${pack.credits}`,
    metadata: { userId: user.id, credits: pack.credits },
  });

  // NOTE: credits are granted in the payment webhook ONLY after success.
  return ok({ pack: key, credits: pack.credits, amount: pack.amount, paymentId: intent.paymentId });
});