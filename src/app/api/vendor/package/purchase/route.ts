import { ok, demoUnavailable } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { ApiError } from "@/lib/api/errors";
import { paymentGateway } from "@/services/payments";
import {
  PRO_PACKAGE_PRICE_TOMAN,
  vendorPackageState,
} from "@/services/vendorPackage";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/vendor/package/purchase — خرید «پکیج فروشنده» (۲٬۲۸۰٬۰۰۰ تومان/ماه)
 *
 * فقط در پنل فروشنده (requireVendorMember + manager). قیمت از سرور
 * (PLATFORM.vendor.proPackage) می‌آید — هرگز از کلاینت. با پرداخت موفق،
 * fulfillment (وب‌هوک درگاه یا confirm دمو) اشتراک را فعال می‌کند و نرخ
 * مؤثر کمیسیون همان لحظه روی ردیف‌های صورت‌حساب ۵٪ snapshot می‌شود.
 *
 * درگاه: زرین‌پال وقتی ZARINPAL_MERCHANT_ID ست باشد؛ در سندباکس/دمو
 * DevPaymentProvider با confirmable=true مسیر تست می‌دهد. بدون کلید در
 * پروداکشن خطای صادقانه — هیچ پرداخت فیک ثبت نمی‌شود.
 */
export const POST = guard(async (req: NextRequest) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("خرید پکیج فروشنده (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);

  await rateLimit(`vendor:package:${ctx.userId}`, { windowMs: 60_000, max: 5 });

  // فروشگاه باید فعال باشد — پکیجِ فروشگاهِ تعلیق/در انتظار معنا ندارد.
  if (ctx.vendor.status !== "active") {
    throw ApiError.forbidden("پکیج فقط برای فروشگاه‌های فعال قابل خرید است");
  }

  const current = await vendorPackageState(ctx.vendor.id);

  // بدون درگاهِ پیکربندی‌شده در پروداکشن، پیام صادقانهٔ فارسی — نه استک‌تریس.
  let gateway;
  try {
    gateway = paymentGateway();
  } catch {
    throw new ApiError(
      "GATEWAY_NOT_CONFIGURED",
      "درگاه پرداخت هنوز فعال نشده است — پس از فعال‌سازی درگاه بانکی، این گزینه به‌صورت خودکار کار می‌کند.",
      503,
    );
  }
  const amountIrr = PRO_PACKAGE_PRICE_TOMAN * 10; // Toman → IRR (واحد تسویهٔ درگاه)
  const intent = await gateway.createIntent({
    amount: amountIrr,
    currency: "IRR",
    orderId: `vpro-${ctx.vendor.id}-${Date.now().toString(36)}`,
    description: `پکیج فروشنده هومینو — کارمزد ۵٪ به‌جای ۹٪ (یک ماه)`,
    metadata: {
      kind: "vendor_package",
      userId: ctx.userId,
      vendorId: ctx.vendor.id,
    },
  });

  return ok({
    paymentId: intent.paymentId,
    provider: intent.provider,
    paymentUrl: intent.paymentUrl ?? null,
    confirmable: intent.provider === "dev",
    amountToman: PRO_PACKAGE_PRICE_TOMAN,
    ...(current.active ? { renewsAt: current.expiresAt } : {}),
  });
});
