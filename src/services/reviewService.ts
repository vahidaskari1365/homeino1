import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders, products, reviews } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Reviews — only users with a delivered order for the product may leave a
 * VERIFIED review. The check is enforced server-side against order_items.
 */
export async function listProductReviews(productId: string, page = 1, limit = 10) {
  const db = getDb();
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt))
    .limit(Math.min(50, limit))
    .offset((page - 1) * limit);
  return rows;
}

export async function hasDeliveredOrder(userId: string, productId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orderItems.productId, productId),
        eq(orders.userId, userId),
        inArray(orderItems.status, ["delivered", "refunded"]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createReview(
  userId: string,
  input: { productId: string; rating: number; title?: string; content?: string },
) {
  const db = getDb();
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));

  if (!(await hasDeliveredOrder(userId, input.productId))) {
    throw ApiError.forbidden("برای ثبت نظر باید این محصول را خریداری و تحویل گرفته باشید");
  }

  const [existing] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.productId, input.productId)))
    .limit(1);
  if (existing) throw ApiError.conflict("قبلاً برای این محصول نظر ثبت کرده‌اید");

  const [review] = await db
    .insert(reviews)
    .values({
      userId,
      productId: input.productId,
      rating,
      title: input.title,
      content: input.content,
      verifiedPurchase: true,
      status: "pending",
    })
    .returning();
  return review;
}

/** Recompute aggregate rating after a review is approved. */
export async function recomputeProductRating(productId: string) {
  const db = getDb();
  const [agg] = await db
    .select({ avg: sql<number>`avg(${reviews.rating})`, count: sql<number>`count(*)` })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "approved")));
  if (agg) {
    await db
      .update(products)
      .set({
        rating: Math.round((agg.avg ?? 0) * 100) / 10,
        reviewsCount: Number(agg.count ?? 0),
      })
      .where(eq(products.id, productId));
      }
      }