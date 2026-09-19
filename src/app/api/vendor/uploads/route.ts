import { ok, demoUnavailable } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { ApiError } from "@/lib/api/errors";
import {
  standardizeProductImage,
  persistProductImage,
  PRODUCT_IMAGE_STANDARD,
} from "@/services/media/productImageAgent";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/vendor/uploads — آپلود تصویر محصول فروشنده (multipart/form-data)
 *
 * ایجنت استانداردسازی تصویر: هر فایلی که برسد، خودکار به استاندارد سایت
 * (مربع ۱۲۰۰×۱۲۰۰، WebP q82، چرخش EXIF، حذف متادیتا) تبدیل و روی R2 /
 * Supabase Storage ذخیره می‌شود؛ پاسخ شامل URL + گزارش کامل عملیات است.
 *
 * گیت‌ها: نشست واقعی + عضویت فروشگاه + نقش manager/owner + rate-limit.
 * بدون DATABASE_URL مثل بقیهٔ خانوادهٔ /api/vendor صداقت دموی ۵۰۳ می‌دهد.
 */
export const POST = guard(async (req: NextRequest) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("آپلود تصویر محصول (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);

  // پردازش تصویر سنگین‌تر از JSON است — ۱۲ آپلود در دقیقه برای هر فروشنده
  await rateLimit(`vendor:upload:${ctx.userId}`, { windowMs: 60_000, max: 12 });

  const form = await req.formData().catch(() => null);
  if (!form) throw ApiError.badRequest("فرم ارسال‌شده نامعتبر است");

  const file = form.get("file") ?? form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw ApiError.badRequest("انتخاب عکس الزامی است");
  }
  if (file.size > PRODUCT_IMAGE_STANDARD.maxInputBytes) {
    throw ApiError.badRequest(
      `حجم عکس باید کمتر از ${Math.round(PRODUCT_IMAGE_STANDARD.maxInputBytes / (1024 * 1024))} مگابایت باشد`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { buffer, report } = await standardizeProductImage({ bytes, filename: file.name });
  const persisted = await persistProductImage(buffer, { vendorId: ctx.vendor.id });

  return ok(
    {
      url: persisted.url,
      storage: persisted.storage,
      width: report.output.width,
      height: report.output.height,
      bytes: report.output.bytes,
      report,
    },
    { status: 201 },
  );
});
