import type { NextRequest } from "next/server";
import { guard, readBody } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@/lib/api/errors";
import { ok, demoUnavailable } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import {
  getVendorIdBySlug,
  listCustomerThread,
  normalizeMessageBody,
  sendCustomerMessage,
} from "@/services/storeMessages";

export const runtime = "nodejs";

/**
 * GET /api/stores/[slug]/messages — رشتهٔ گفتگوی من با این فروشگاه (Task 60)
 * پاسخ‌های فروشنده هنگام خواندن، خوانده‌شده ثبت می‌شوند.
 */
export const GET = guard(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("گفتگو با فروشگاه");
  const { slug } = await params;
  const { user } = await requireUser(req);

  const vendorId = await getVendorIdBySlug(slug);
  if (!vendorId) throw ApiError.notFound("فروشگاه یافت نشد");

  const { items } = await listCustomerThread(vendorId, user.id);
  return ok({ items });
});

/**
 * POST /api/stores/[slug]/messages — ارسال پیام به فروشگاه (Task 60)
 * بدنه: { body } — پیام جدید مشتری اعلان «پیام جدید از مشتری» برای فروشنده
 * می‌سازد (درون‌سایتی + SMS به‌محض فعال‌شدن پنل پیامک مالک).
 */
export const POST = guard(async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("گفتگو با فروشگاه");
  const { slug } = await params;
  const { user } = await requireUser(req);
  await rateLimit(`store-message:${user.id}`, { windowMs: 60_000, max: 10 });

  const body = normalizeMessageBody((await readBody(req) as { body?: unknown })?.body);
  if (!body) throw ApiError.badRequest("متن پیام خالی است");

  const vendorId = await getVendorIdBySlug(slug);
  if (!vendorId) throw ApiError.notFound("فروشگاه یافت نشد");

  try {
    const message = await sendCustomerMessage({ vendorId, customerId: user.id, body });
    return ok({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "vendor_not_available") {
      throw ApiError.notFound("این فروشگاه در حال حاضر فعال نیست");
    }
    throw err;
  }
});
