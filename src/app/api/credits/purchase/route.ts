import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { paymentGateway } from "@/services/payments";
import { getDb } from "@/db";
import { creditPackages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Fallback pack list (Toman) — used only when the `credit_packages` table is
 * unreachable. The DB (seeded in 202609060001) is the single price list.
 */
export const PACKS: Record<string, { credits: number; amount: number }> = {
  starter: { credits: 50, amount: 100_000 },
  popular: { credits: 120, amount: 220_000 },
  pro: { credits: 300, amount: 500_000 },
};

/**
 * Purchase flow: create a payment intent for a credit pack; on successful
 * payment the WEBHOOK grants credits (single fulfillment path). The pack
 * price lives on the SERVER, never in a client request.
 *
 * Currency: amounts in this service are Toman; gateways settle in IRR.
 * 1 Toman = 10 IRR, so the intent amount is converted once, here.
 */
export const POST = guard(async (req) => {
  const { user } = await requireUser(req);
  const key = req.nextUrl.searchParams.get("pack") ?? "popular";

  let credits = 0;
  let amountToman = 0;
  let fromDb = false;
  if (process.env.DATABASE_URL) {
    try {
      const db = getDb();
      const [row] = await db
        .select()
        .from(creditPackages)
        .where(eq(creditPackages.slug, key))
        .limit(1);
      if (row && row.isActive) {
        credits = row.credits;
        // DB stores IRR (gateway currency) → display/ledger math in Toman.
        amountToman = Math.round(row.price / 10);
        fromDb = true;
      }
    } catch {
      // table missing → fallback pack list
    }
  }
  if (!fromDb) {
    const pack = PACKS[key];
    if (!pack) throw ApiError.badRequest("بسته اعتباری نامعتبر است");
    credits = pack.credits;
    amountToman = pack.amount;
  }

  const gateway = paymentGateway();
  const intent = await gateway.createIntent({
    amount: amountToman * 10, // Toman → IRR (gateway settlement unit)
    currency: "IRR",
    orderId: `credits-${user.id}-${Date.now().toString(36)}`,
    description: `خرید ${credits} اعتبار هومینو استودیو`,
    metadata: { userId: user.id, credits, kind: "credits" },
  });

  // NOTE: credits are granted ONLY in the webhook/confirm fulfillment path.
  return ok({
    pack: key,
    credits,
    amount: amountToman,
    amountIrr: amountToman * 10,
    paymentId: intent.paymentId,
    provider: intent.provider,
    confirmable: intent.provider === "dev",
  });
});
