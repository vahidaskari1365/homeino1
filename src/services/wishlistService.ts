import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { wishlistItems, wishlists } from "@/db/schema";

export async function getOrCreateWishlist(userId: string) {
  const db = getDb();
  const existing = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
  if (existing.length) return existing[0];
  const [created] = await db.insert(wishlists).values({ userId }).returning();
  return created;
}

export async function listWishlist(userId: string) {
  const db = getDb();
  const wl = await getOrCreateWishlist(userId);
  const items = await db
    .select({ wishlistId: wishlistItems.wishlistId, productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.wishlistId, wl.id));
  return items.map((i) => i.productId);
}

export async function addToWishlist(userId: string, productId: string) {
  const db = getDb();
  const wl = await getOrCreateWishlist(userId);
  await db
    .insert(wishlistItems)
    .values({ wishlistId: wl.id, productId })
    .onConflictDoNothing();
  return listWishlist(userId);
}

export async function removeFromWishlist(userId: string, productId: string) {
  const db = getDb();
  const wl = await getOrCreateWishlist(userId);
  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.wishlistId, wl.id), eq(wishlistItems.productId, productId)));
  return listWishlist(userId);
}

export async function isWishlisted(userId: string, productId: string) {
  const db = getDb();
  const wl = await getOrCreateWishlist(userId);
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.wishlistId, wl.id), eq(wishlistItems.productId, productId)))
    .limit(1);
  return rows.length > 0;
}