import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  cartItems,
  carts,
  inventory,
  products,
  productVariants,
  vendors,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Cart rules:
 * - one active cart per user
 * - price is snapshotted at add-time (never read live later)
 * - stock is checked at add time and reserved at order time
 */
export async function getOrCreateActiveCart(userId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), eq(carts.status, "active")))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(carts).values({ userId }).returning();
  return created;
}

export async function getCart(userId: string) {
  const db = getDb();
  const cart = await getOrCreateActiveCart(userId);
  const items = await db
    .select({
      item: cartItems,
      product: products,
      variant: productVariants,
      vendor: vendors,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(vendors, eq(vendors.id, cartItems.vendorId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(cartItems.addedAt);

  const subtotal = items.reduce((s, r) => s + r.item.priceSnapshot * r.item.quantity, 0);
  return {
    id: cart.id,
    items: items.map((r) => ({
      id: r.item.id,
      productId: r.product.id,
      slug: r.product.slug,
      title: r.product.title,
      image: r.product.metadata?.primaryImage as string | undefined,
      vendorId: r.vendor.id,
      vendorSlug: r.vendor.slug,
      vendorName: r.vendor.name,
      variantId: r.item.variantId,
      variantName: r.variant?.name,
      quantity: r.item.quantity,
      unitPrice: r.item.priceSnapshot,
      total: r.item.priceSnapshot * r.item.quantity,
      currency: r.item.currency,
    })),
    subtotal,
    currency: "IRR",
  };
}

export async function addToCart(
  userId: string,
  input: { productId: string; variantId?: string; quantity?: number },
) {
  const db = getDb();
  const qty = Math.min(99, Math.max(1, input.quantity ?? 1));

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
    .limit(1);
  if (!product) throw ApiError.notFound("محصول یافت نشد");
  if (product.status === "archived" || product.status === "draft") {
    throw ApiError.badRequest("این محصول قابل خرید نیست");
  }

  // real inventory check — never trust frontend state
  const [inv] = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.productId, product.id),
        input.variantId ? eq(inventory.variantId!, input.variantId) : isNull(inventory.variantId),
      ),
    )
    .limit(1);
  const available = inv ? inv.quantity - inv.reservedQuantity : 0;
  // A purchasable product MUST have an inventory record: without one the
  // order creation would fail later (or worse, oversell). Missing row =
  // unavailable, with the same honest message.
  if (!inv || (available <= 0 && product.status === "active")) {
    throw new ApiError("OUT_OF_STOCK", "محصول در انبار موجود نیست", 422);
  }

  let price = product.price;
  if (input.variantId) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId))
      .limit(1);
    if (!variant || variant.productId !== product.id) {
      throw ApiError.badRequest("تنوع نامعتبر است");
    }
    price += variant.priceDelta;
  }

  const cart = await getOrCreateActiveCart(userId);

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.cartId, cart.id),
        eq(cartItems.productId, product.id),
        input.variantId ? eq(cartItems.variantId!, input.variantId) : isNull(cartItems.variantId),
      ),
    )
    .limit(1);

  if (existing) {
    const newQty = Math.min(99, existing.quantity + qty);
    await db
      .update(cartItems)
      .set({ quantity: newQty, priceSnapshot: price })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      cartId: cart.id,
      vendorId: product.vendorId,
      productId: product.id,
      variantId: input.variantId ?? null,
      quantity: qty,
      priceSnapshot: price,
      currency: product.currency,
    });
  }
  return getCart(userId);
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  const db = getDb();
  const cart = await getOrCreateActiveCart(userId);
  const qty = Math.min(99, Math.max(0, Math.floor(quantity)));
  const [item] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
    .limit(1);
  if (!item) throw ApiError.notFound("آیتم سبد یافت نشد");
  if (qty === 0) {
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
  } else {
    await db.update(cartItems).set({ quantity: qty }).where(eq(cartItems.id, itemId));
  }
  return getCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  const db = getDb();
  const cart = await getOrCreateActiveCart(userId);
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)));
  return getCart(userId);
}

export async function clearCart(userId: string) {
  const db = getDb();
  const cart = await getOrCreateActiveCart(userId);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  return getCart(userId);
}