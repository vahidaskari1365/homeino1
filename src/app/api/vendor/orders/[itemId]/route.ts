import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isEnum } from "@/lib/api/validate";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orderStatusHistory, orders } from "@/db/schema";
import { requireVendorMember } from "@/lib/api/vendorAuth";
import { markItemsAvailable } from "@/services/vendorSettlement";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ itemId: string }> };

/**
 * Legal ITEM transitions for the vendor (mirrors ORDER_TRANSITIONS but at the
 * per-vendor item level — one order can contain several vendors).
 */
const ITEM_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["confirmed"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Advance one of THIS vendor's order items through its fulfilment lifecycle. */
export const PATCH = guard(async (req, { params }: Params) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("تغییر وضعیت سفارش (API)");
  const ctx = await requireVendorMember(req);
  const { itemId } = await params;
  const input = validate(await readBody(req), {
    status: isEnum(["confirmed", "processing", "shipped", "delivered", "cancelled"]),
  });
  const db = getDb();

  const [item] = await db
    .select({ id: orderItems.id, status: orderItems.status, orderId: orderItems.orderId })
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.vendorId, ctx.vendor.id)))
    .limit(1);
  if (!item) throw ApiError.notFound("آیتم سفارش یافت نشد");

  const allowed = ITEM_TRANSITIONS[item.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw ApiError.badRequest(`گذار وضعیت مجاز نیست (از «${item.status}» به «${input.status}»)`);
  }

  // Cancel is vendor-visible only as a rejection before processing; buyer
  // refunds flow through the payment provider and the admin.
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orderItems)
      .set({ status: input.status })
      .where(eq(orderItems.id, itemId))
      .returning({ id: orderItems.id, status: orderItems.status });

    await tx.insert(orderStatusHistory).values({
      orderId: item.orderId,
      fromStatus: item.status as never,
      toStatus: input.status === "cancelled" ? "cancelled" : (await tx.select({ s: orders.status }).from(orders).where(eq(orders.id, item.orderId)).limit(1))[0].s,
      actorId: `vendor:${ctx.vendor.id}`,
      note: `آیتم «${updated.status}» شد (توسط فروشنده)`,
    });
    return updated;
  });

  // Delivered → the commission row becomes payable.
  if (input.status === "delivered") {
    await markItemsAvailable([itemId]).catch(() => undefined);
  }

  return ok(result);
});
