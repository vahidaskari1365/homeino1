import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { ApiError } from "@/lib/api/errors";
import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isString } from "@/lib/api/validate";
import { DevPaymentProvider, paymentGateway } from "@/services/payments";
import { fulfillPaymentEvent } from "@/services/paymentFulfillment";
import { vendorPackageState } from "@/services/vendorPackage";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/vendor/package/confirm — تأیید پرداختِ دموی پکیج فروشنده.
 *
 * دقیقاً الگوی /api/credits/purchase/confirm: با درگاه واقعی غیرفعال است
 * (وب‌هوک/کال‌بک زرین‌پال فعال‌سازی می‌کند)؛ با DevPaymentProvider، intent
 * باید قبلاً از سرور برای همین کاربر صادر شده باشد (متادیتای سرور مبناست،
 * نه اکوی کلاینت) و فعال‌سازی از همان مسیر fulfillment واحد می‌گذرد.
 */
export const POST = guard(async (req: NextRequest) => {
  if (!process.env.DATABASE_URL) {
    return demoUnavailable("تأیید خرید پکیج (API)");
  }
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);

  const body = await readBody(req);
  const input = validate(body, { paymentId: isString(64) });

  const gateway = paymentGateway();
  if (!(gateway instanceof DevPaymentProvider)) {
    throw ApiError.badRequest("با درگاه واقعی، تأیید پرداخت توسط وب‌هوک انجام می‌شود");
  }

  // Server-issued intent only: must belong to THIS user AND this vendor.
  const meta = gateway.consumeIntent(input.paymentId, {
    userId: ctx.userId,
    kind: "vendor_package",
    vendorId: ctx.vendor.id,
  });
  if (!meta) {
    throw new ApiError("UNAUTHORIZED", "پرداخت یافت نشد یا متعلق به شما نیست", 403);
  }

  const result = await fulfillPaymentEvent({
    provider: "dev",
    providerPaymentId: input.paymentId,
    eventType: "payment.succeeded",
    amount: 0, // dev: مبلغ واقعی از PLATFORM در سرویس فعال‌سازی می‌آید
    currency: "IRR",
    metadata: {
      kind: "vendor_package",
      userId: ctx.userId,
      vendorId: ctx.vendor.id,
    },
    raw: { paymentId: input.paymentId },
  });
  if (!result.ok || result.kind !== "vendor_package") {
    throw ApiError.badRequest("تأیید پرداخت ناموفق بود");
  }

  const state = await vendorPackageState(ctx.vendor.id);
  return ok({
    ok: true,
    duplicate: result.duplicate,
    package: state,
  });
});
