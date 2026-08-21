import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  cartItems,
  carts,
  inventory,
  orderItems,
  orders,
  orderStatusHistory,
  orderStatusEnum,
  products,
  users,
  vendors,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Order creation is transactional:
 * 1. read the active cart + items
 * 2. reserve inventory (quantity -> reserved_quantity)
 * 3. snapshot product data into order_items
 * 4. write order + status history
 * 5. convert cart to "converted"
 * Nothing is applied half-way — any failure rolls back the whole order.
 */
export async function createOrderFromCart(
  userId: string,
  input: {
    shippingAddress: Record<string, unknown>;
    billingAddress?: Record<string, unknown>;
    customerNote?: string;
  },
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [cart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.userId, userId), eq(carts.status, "active")))
      .limit(1);
    if (!cart) throw ApiError.badRequest("سبد خرید خالی است");

    const rows = await tx
      .select({ item: cartItems, product: products, vendor: vendors })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .innerJoin(vendors, eq(vendors.id, cartItems.vendorId))
      .where(eq(cartItems.cartId, cart.id));
    if (rows.length === 0) throw ApiError.badRequest("سبد خرید خالی است");

    let subtotal = 0;
    const prepared: {
      vendorId: string;
      productId: string;
      variantId: string | null;
      titleSnapshot: string;
      skuSnapshot: string | null;
      imageSnapshot: string | null;
      unitPrice: number;
      quantity: number;
      total: number;
    }[] = [];

    for (const r of rows) {
      // inventory reservation
      const [inv] = await tx
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, r.product.id),
            r.item.variantId ? eq(inventory.variantId!, r.item.variantId) : isNull(inventory.variantId),
          ),
        )
        .limit(1)
        .for("update");
      if (!inv || inv.quantity - inv.reservedQuantity < r.item.quantity) {
        throw new ApiError("OUT_OF_STOCK", `موجودی «${r.product.title}» کافی نیست`, 422);
      }
      await tx
        .update(inventory)
        .set({ reservedQuantity: inv.reservedQuantity + r.item.quantity })
        .where(eq(inventory.id, inv.id));

      const total = r.item.priceSnapshot * r.item.quantity;
      subtotal += total;
      prepared.push({
        vendorId: r.product.vendorId,
        productId: r.product.id,
        variantId: r.item.variantId,
        titleSnapshot: r.product.title,
        skuSnapshot: r.product.sku,
        imageSnapshot: (r.product.metadata as { primaryImage?: string } | null)?.primaryImage ?? null,
        unitPrice: r.item.priceSnapshot,
        quantity: r.item.quantity,
        total,
      });
    }

    const orderNumber = `HO-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        orderNumber,
        status: "pending",
        subtotal,
        shippingTotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        total: subtotal,
        currency: "IRR",
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress ?? input.shippingAddress,
        customerNote: input.customerNote,
      })
      .returning();

    await tx.insert(orderItems).values(prepared.map((p) => ({ ...p, orderId: order.id })));
    await tx.insert(orderStatusHistory).values({ orderId: order.id, toStatus: "pending" });

    // convert the cart — no double-order from the same cart
    await tx.update(carts).set({ status: "converted" }).where(eq(carts.id, cart.id));

    return order;
  });
}

export async function listOrders(userId: string, page = 1, limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(Math.min(50, limit))
    .offset((page - 1) * limit);
  return rows;
}

export async function getOrderForUser(userId: string, orderId: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) throw ApiError.notFound("سفارش یافت نشد");
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(eq(orderStatusHistory.orderId, order.id))
    .orderBy(desc(orderStatusHistory.createdAt));
  return { ...order, items, history };
}

export async function getOrderByNumber(orderNumber: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) throw ApiError.notFound("سفارش یافت نشد");
  return order;
}

/** Vendor-facing: orders that contain this vendor's items. */
export async function listVendorOrders(vendorId: string, page = 1, limit = 20) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const vendorItems = await db
    .select({ orderId: orderItems.orderId })
    .from(orderItems)
    .where(eq(orderItems.vendorId, vendorId))
    .groupBy(orderItems.orderId)
    .limit(limit)
    .offset(offset);
  const ids = vendorItems.map((v) => v.orderId);
  if (ids.length === 0) return { items: [], meta: { page, limit, total: 0, hasMore: false } };
  const rows = await db
    .select()
    .from(orders)
    .where(inArray(orders.id, ids))
    .orderBy(desc(orders.createdAt));
  return { items: rows, meta: { page, limit, total: rows.length, hasMore: false } };
}

export async function updateOrderStatus(
  orderId: string,
  toStatus: (typeof orderStatusEnum.enumValues)[number],
  actorId: string,
  note?: string,
) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw ApiError.notFound("سفارش یافت نشد");

  // cancelled orders release reserved inventory
  if (toStatus === "cancelled" && order.status !== "cancelled") {
    await releaseReservedStock(orderId);
  }

  await db
    .update(orders)
    .set({ status: toStatus })
    .where(eq(orders.id, orderId));
  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: order.status,
    toStatus,
    actorId,
    note,
  });
  return getOrderForUser(order.userId, orderId);
}

async function releaseReservedStock(orderId: string) {
  const db = getDb();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    const [inv] = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.productId, item.productId),
          item.variantId ? eq(inventory.variantId!, item.variantId) : isNull(inventory.variantId),
        ),
      )
      .limit(1);
    if (inv) {
      await db
        .update(inventory)
        .set({ reservedQuantity: Math.max(0, inv.reservedQuantity - item.quantity) })
        .where(eq(inventory.id, inv.id));
    }
  }
}