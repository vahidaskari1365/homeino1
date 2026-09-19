import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, parsePagination, readBody } from "@/lib/api/http";
import { requireVendorMember } from "@/lib/api/vendorAuth";
import {
  listVendorNotifications,
  markVendorNotificationsRead,
  unreadVendorNotificationCount,
} from "@/services/vendorNotifications";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/vendor/notifications — صندوق پیام فروشنده (Task 59)
 * خوانده‌نشده‌ها: ?unread=1 | سقف: ?limit=30 (۱..۱۰۰)
 */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("اطلاع‌رسانی فروشنده (API)");
  const ctx = await requireVendorMember(req);
  const params = new URL(req.url).searchParams;
  const { limit } = parsePagination(params);
  const unreadOnly = params.get("unread") === "1";

  const [{ items }, unread] = await Promise.all([
    listVendorNotifications(ctx.vendor.id, { limit, unreadOnly }),
    unreadVendorNotificationCount(ctx.vendor.id),
  ]);
  return ok({ unread, items });
});

/**
 * POST /api/vendor/notifications — علامت‌گذاری خوانده‌شده
 * بدنه: { all: true } یا { ids: [...] } — فقط پیام‌های همین فروشگاه.
 */
export const POST = guard(async (req: NextRequest) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("اطلاع‌رسانی فروشنده (API)");
  const ctx = await requireVendorMember(req);

  let body: { ids?: unknown; all?: unknown } = {};
  try {
    body = (await readBody(req)) as typeof body;
  } catch {
    // بدنهٔ خالی → همه خوانده شود (رفتار دکمهٔ «همه خواندم»)
  }
  const all = body?.all === true;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : undefined;

  if (!all && (!ids || ids.length === 0)) {
    return ok({ updated: 0 });
  }
  const { updated } = await markVendorNotificationsRead(ctx.vendor.id, { ids, all });
  return ok({ updated });
});
