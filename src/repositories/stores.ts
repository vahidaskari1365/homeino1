import type { Store, Collection } from "@/types";
import { stores as mockStores, getStore, getStoreById, collections as mockCollections } from "@/data/stores";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { collections, collectionProducts, products, vendors } from "@/db/schema";

export interface StoresRepository {
  list(): Promise<Store[]>; bySlug(slug: string): Promise<Store | undefined>; byId(id: string): Promise<Store | undefined>;
  verified(): Promise<Store[]>; collections(): Promise<Collection[]>;
}
async function remoteStores(): Promise<Store[]> {
  const rows = await getDb().select().from(vendors).where(eq(vendors.status, "active")).orderBy(asc(vendors.name));
  const productRows = await getDb().select({ vendorId: products.vendorId }).from(products).where(eq(products.status, "active"));
  return rows.map(v => ({
    id: v.id, slug: v.slug, name: v.name, logo: v.logo ?? v.name.slice(0, 1), logoColor: String(v.metadata?.logoColor ?? "#c2703f"),
    cover: v.cover ?? "", description: v.description ?? "", rating: Number(v.rating), reviewsCount: v.reviewsCount,
    productCount: productRows.filter(p => p.vendorId === v.id).length, city: v.city ?? "", verified: v.verificationStatus === "verified",
    trending: v.salesCount > 1000, isNew: false, categorySlugs: [], salesCount: v.salesCount, followersCount: v.followersCount,
    sinceYear: v.sinceYear ?? 1400, responseTime: v.responseTime ?? "", badges: v.badges ?? [],
    shippingPolicy: v.shippingPolicy ?? "", returnPolicy: v.returnPolicy ?? "",
  }));
}
async function remoteCollections(): Promise<Collection[]> {
  const db = getDb();
  const rows = await db.select().from(collections).where(and(eq(collections.isPublic, true), or(isNull(collections.userId), eq(collections.isPublic, true))));
  const items = await db.select().from(collectionProducts);
  return rows.map(c => ({ id: c.id, slug: c.slug ?? c.id, title: c.title, subtitle: c.subtitle ?? "", image: c.image ?? "", count: items.filter(i => i.collectionId === c.id).length }));
}
export const storesRepository: StoresRepository = {
  list: async () => process.env.DATABASE_URL ? remoteStores() : mockStores,
  bySlug: async slug => process.env.DATABASE_URL ? (await remoteStores()).find(v => v.slug === slug) : getStore(slug),
  byId: async id => process.env.DATABASE_URL ? (await remoteStores()).find(v => v.id === id) : getStoreById(id),
  verified: async () => (process.env.DATABASE_URL ? await remoteStores() : mockStores).filter(v => v.verified),
  collections: async () => process.env.DATABASE_URL ? remoteCollections() : mockCollections,
};
