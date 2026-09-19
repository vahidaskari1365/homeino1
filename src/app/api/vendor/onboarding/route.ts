import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isString, isOptionalString } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@/lib/api/errors";
import { createVendorForUser } from "@/lib/api/vendorAuth";
import { requireUser } from "@/lib/api/auth";

export const runtime = "nodejs";

/**
 * Vendor onboarding — creates the real vendor row (status=pending),
 * the owner membership and the settings rows for the signed-in user.
 * Admin approval later flips status → active.
 */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("ثبت‌نام فروشنده (API)");
  const input = validate(await readBody(req), {
    name: isString(140),
    city: isOptionalString(80),
    contactEmail: isOptionalString(320),
    contactPhone: isOptionalString(32),
    description: isOptionalString(2000),
  });
  await rateLimit(`vendor-onboard:${(await requireUser(req)).user.id}`, { windowMs: 60_000, max: 5 });

  const { user } = await requireUser(req);
  if (input.name.trim().length < 2) throw ApiError.badRequest("نام فروشگاه حداقل ۲ کاراکتر است");

  const result = await createVendorForUser({
    userId: user.id,
    name: input.name.trim(),
    city: input.city,
    contactEmail: input.contactEmail ?? user.email,
    contactPhone: input.contactPhone,
    description: input.description,
  });
  return ok(result, { status: result.created ? 201 : 200 });
});
