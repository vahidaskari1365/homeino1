import type { NextRequest } from "next/server";
import { guard, readBody } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/rateLimit";
import { ApiError } from "@/lib/api/errors";
import { ok, demoUnavailable } from "@/lib/api/response";
import { requireVendorMember } from "@/lib/api/vendorAuth";
import {
  listVendorThread,
  listVendorThreads,
  normalizeMessageBody,
  sendVendorReply,
  unreadVendorMessageCount,
} from "@/services/storeMessages";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/vendor/messages — صندوق گفتگوی مشتریان فروشنده (Task 60)
 *   بدون پارامتر → فهرست رشته‌ها (خوانده‌نشدهٔ هر مشتری)
 *   ?customer=<uuid> → رشتهٔ یک مشتری + ثبت خواندن پیام‌های مشتری
 */
export const GET = guard(async (req: NextRequest) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("پیام‌های مشتریان");
  const ctx = await requireVendorMember(req);
  const customerId = new URL(req.url).searchParams.get("customer");

  if (customerId) {
    if (!UUID_RE.test(customerId)) throw ApiError.badRequest("شناسهٔ مشتری نامعتبر است");
    const { items } = await listVendorThread(ctx.vendor.id, customerId);
    return ok({ items });
  }

  const [{ items }, unread] = await Promise.all([
    listVendorThreads(ctx.vendor.id),
    unreadVendorMessageCount(ctx.vendor.id),
  ]);
  return ok({ threads: items, unread });
});

/**
 * POST /api/vendor/messages — پاسخ فروشنده به مشتری (Task 60)
 * بدنه: { customerId, body } — فقط در رشتهٔ موجود (مشتری باید قبلاً پیام داده باشد).
 */
export const POST = guard(async (req: NextRequest) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("پیام‌های مشتریان");
  const ctx = await requireVendorMember(req);
  await rateLimit(`vendor-reply:${ctx.userId}`, { windowMs: 60_000, max: 30 });

  const input = (await readBody(req)) as { customerId?: unknown; body?: unknown };
  const customerId = typeof input?.customerId === "string" ? input.customerId : "";
  if (!UUID_RE.test(customerId)) throw ApiError.badRequest("شناسهٔ مشتری نامعتبر است");
  const body = normalizeMessageBody(input?.body);
  if (!body) throw ApiError.badRequest("متن پاسخ خالی است");

  try {
    const message = await sendVendorReply({ vendorId: ctx.vendor.id, customerId, body });
    return ok({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "thread_not_found") {
      throw ApiError.notFound("رشتهٔ گفتگو با این مشتری یافت نشد");
    }
    throw err;
  }
});
