import { demoUnavailable, page } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { requireVendorMember } from "@/lib/api/vendorAuth";

export const runtime = "nodejs";

/**
 * Vendor order queue — order items that belong to THIS vendor, with the
 * buyer-side order status. The item lifecycle (confirmed → processing →
 * shipped → delivered) is advanced through /api/vendor/orders/[itemId].
 */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("سفارش‌های فروشنده (API)");
  const ctx = await requireVendorMember(req);
  const { page: pageNum, limit } = parsePagination(new URL(req.url).searchParams);
  const offset = (pageNum - 1) * limit;
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const db = getDb();

  const conds = [eq(orderItems.vendorId, ctx.vendor.id)];
  if (statusFilter && ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].includes(statusFilter)) {
    conds.push(inArray(orderItems.status, [statusFilter as never]));
  }

  const rows = await db
    .select({
      itemId: orderItems.id,
      itemStatus: orderItems.status,
      title: orderItems.titleSnapshot,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      placedAt: orders.placedAt,
      customerNote: orders.customerNote,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(...conds))
    .orderBy(desc(orders.placedAt))
    .limit(limit)
    .offset(offset);

  return page(rows, { total: rows.length, page: pageNum, limit, hasMore: rows.length === limit });
});
