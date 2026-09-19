import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isEnum, isOptionalString } from "@/lib/api/validate";
import { requireAdminUser } from "@/lib/api/auth";
import { adminPayoutAction } from "@/services/vendorSettlement";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ payoutId: string }> };

/** Admin settlement decision: approve / reject / mark paid (with reference). */
export const POST = guard(async (req, { params }: Params) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("تصمیم تسویه (مدیر)");
  const { user } = await requireAdminUser(req);
  const { payoutId } = await params;
  const input = validate(await readBody(req), {
    action: isEnum(["approve", "reject", "mark_paid"]),
    reference: isOptionalString(120),
    note: isOptionalString(500),
  });

  const result = await adminPayoutAction({
    payoutId,
    action: input.action,
    adminUserId: user.id,
    reference: input.reference,
    note: input.note,
  });
  if (!result.ok) {
    if (result.reason === "payout_not_found") throw ApiError.notFound("درخواست تسویه یافت نشد");
    throw ApiError.badRequest("این تغییر وضعیت در مرحلهٔ فعلی مجاز نیست");
  }
  return ok(result);
});
