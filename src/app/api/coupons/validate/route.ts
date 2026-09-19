import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isOptionalString, isString } from "@/lib/api/validate";
import { normalizeCouponCode, validateCouponForPack } from "@/services/coupons";

export const runtime = "nodejs";

/** Validate a coupon for the logged-in user + pack (server is authoritative). */
export const POST = guard(async (req) => {
  const { user } = await requireUser(req);
  const input = validate(await readBody(req), {
    code: isString(40),
    pack: isOptionalString(80),
  });
  const result = await validateCouponForPack(input.code, input.pack, user.id);
  return ok(result);
});

/** Normalization helper exposed for clients that want to mirror the server. */
export const GET = guard(async (req) => {
  const raw = req.nextUrl.searchParams.get("code") ?? "";
  return ok({ code: normalizeCouponCode(raw) });
});
