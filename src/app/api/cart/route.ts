import { getCart, addToCart } from "@/services/cartService";
import { requireUser } from "@/lib/api/auth";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isInt, isOptionalUuid, isUuid } from "@/lib/api/validate";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("سبد خرید (API)", "در حالت دمو، سبد خرید در مرورگر نگهداری می‌شود و این API پس از راه‌اندازی دیتابیس فعال می‌شود.");
  const { user } = await requireUser(req);
  return ok(await getCart(user.id));
});

export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("سبد خرید (API)", "در حالت دمو، سبد خرید در مرورگر نگهداری می‌شود و این API پس از راه‌اندازی دیتابیس فعال می‌شود.");
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, {
    productId: isUuid,
    variantId: isOptionalUuid,
    quantity: isInt(1, 99),
  });
  return ok(await addToCart(user.id, input as { productId: string; variantId?: string; quantity?: number }));
});