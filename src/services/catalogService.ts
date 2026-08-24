import { and, asc, count, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categories,
  inventory,
  productCategories,
  products,
  productImages,
  productStyles,
  productVariants,
  vendors,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

export interface CatalogQuery {
  q?: string;
  categorySlug?: string;
  vendorSlug?: string;
  styleSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "popular" | "rating";
  page?: number;
  limit?: number;
}

const SORTERS = {
  newest: desc(products.createdAt),
  price_asc: asc(products.price),
  price_desc: desc(products.price),
  popular: desc(products.salesCount),
  rating: desc(products.rating),
} as const;

/** Map a product row + joined images/categories/vendor into a catalog DTO. */
export function serializeProduct(row: {
  product: typeof products.$inferSelect;
  vendor?: typeof vendors.$inferSelect;
  images?: { url: string; alt: string | null; isPrimary: boolean }[];
  categories?: { slug: string }[];
}) {
  const p = row.product;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    currency: p.currency,
    rating: p.rating,
    reviewsCount: p.reviewsCount,
    salesCount: p.salesCount,
    images: (row.images ?? []).map((i) => i.url),
    styleSlugs: p.styleSlugs ?? [],
    tags: p.tags ?? [],
    shortDescription: p.shortDescription,
    inStock: p.status === "active",
    vendor: row.vendor
      ? {
          id: row.vendor.id,
          slug: row.vendor.slug,
          name: row.vendor.name,
          logo: row.vendor.logo,
          verified: row.vendor.verificationStatus === "verified",
          rating: Number(row.vendor.rating),
        }
      : undefined,
    categorySlugs: (row.categories ?? []).map((c) => c.slug),
    sku: p.sku ?? null,
    createdAt: p.createdAt,
  };
}

export async function listProducts(query: CatalogQuery = {}) {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(50, Math.max(1, query.limit ?? 12));
  const offset = (page - 1) * limit;

  const conds = [eq(products.status, "active"), isNull(products.deletedAt)];

  if (query.q) {
    conds.push(
      or(
        like(products.title, `%${query.q}%`),
        like(products.description ?? products.title, `%${query.q}%`),
        like(products.brand ?? products.title, `%${query.q}%`),
      )!,
    );
  }
  if (query.vendorSlug) {
    conds.push(eq(vendors.slug, query.vendorSlug));
  }
  if (query.styleSlug) {
    conds.push(inArray(products.id, db.select({ id: productStyles.productId }).from(productStyles).where(eq(productStyles.styleSlug, query.styleSlug))));
  }
  if (query.categorySlug) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, query.categorySlug)).limit(1);
    if (!cat) throw ApiError.notFound("دسته‌بندی یافت نشد");
    const descendants = await descendantIds(cat.id);
    const ids = [cat.id, ...descendants];
    conds.push(
      inArray(
        products.id,
        db.select({ id: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, ids)),
      ),
    );
  }
  if (query.minPrice !== undefined) conds.push(sql`${products.price} >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) conds.push(sql`${products.price} <= ${query.maxPrice}`);

  if (query.inStockOnly) conds.push(sql`${products.status} <> 'out_of_stock'`);

  const where = and(...conds);
  const sorter = SORTERS[query.sort ?? "newest"] ?? SORTERS.newest;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        product: products,
        vendor: vendors,
      })
      .from(products)
      .innerJoin(vendors, eq(vendors.id, products.vendorId))
      .where(where)
      .orderBy(sorter)
      .limit(limit)
      .offset(offset),
    db
      .select({ n: count() })
      .from(products)
      .innerJoin(vendors, eq(vendors.id, products.vendorId))
      .where(where),
  ]);

  const productIds = rows.map((r) => r.product.id);
  const images = productIds.length
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.position))
    : [];
  const cats = productIds.length
    ? await db
        .select({ productId: productCategories.productId, slug: categories.slug })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(inArray(productCategories.productId, productIds))
    : [];

  const byProduct = (pid: string) => images.filter((i) => i.productId === pid);
  const catsByProduct = (pid: string) => cats.filter((c) => c.productId === pid);

  const total = totalRows[0]?.n ?? 0;
  return {
    items: rows.map((r) =>
      serializeProduct({
        product: r.product,
        vendor: r.vendor,
        images: byProduct(r.product.id),
        categories: catsByProduct(r.product.id),
      }),
    ),
    meta: { total, page, limit, hasMore: offset + rows.length < total },
  };
}

export async function getProductBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({ product: products, vendor: vendors })
    .from(products)
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(and(eq(products.slug, slug), isNull(products.deletedAt)))
    .limit(1);
  if (!row) throw ApiError.notFound("محصول یافت نشد");

  const [images, cats] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, row.product.id))
      .orderBy(asc(productImages.position)),
    db
      .select({ slug: categories.slug })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(productCategories.productId, row.product.id)),
  ]);

  // available quantity from inventory (real inventory, not frontend state)
  const [inv] = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.productId, row.product.id), isNull(inventory.variantId)))
    .limit(1);

  return {
    ...serializeProduct({ product: row.product, vendor: row.vendor, images, categories: cats }),
    description: row.product.description,
    dimensions: row.product.dimensions,
    material: row.product.material,
    color: row.product.color,
    sku: row.product.sku,
    availableQuantity: inv ? inv.quantity - inv.reservedQuantity : 0,
  };
}

export async function getCategoryTree() {
  const db = getDb();
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>();
  for (const r of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    byId.set((r as any).id, { ...r, children: [] });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roots: any[] = [];
  for (const row of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = byId.get((row as any).id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((row as any).parentId && byId.has((row as any).parentId)) {
      byId.get((row as any).parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function descendantIds(categoryId: string): Promise<string[]> {
  const db = getDb();
  // categories carry depth+path, so a single path scan is enough
  const rows = await db
    .select({ id: categories.id, path: categories.path })
    .from(categories)
    .where(sql`${categories.path} LIKE ${`%/${categoryId}/%`}`);
  return rows.map((r) => r.id);
}

export async function getProductBySku(sku: string) {
  const db = getDb();
  const needle = sku.trim();
  if (!needle) throw ApiError.notFound("محصول یافت نشد");
  const upper = needle.toUpperCase();

  const [row] = await db
    .select({ product: products, vendor: vendors })
    .from(products)
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(and(
      isNull(products.deletedAt),
      or(
        sql`upper(${products.sku}) = ${upper}`,
        eq(products.slug, needle),
      ),
    ))
    .limit(1);

  let found = row;
  if (!found) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(sql`upper(${productVariants.sku}) = ${upper}`)
      .limit(1);
    if (variant) {
      const [byVariant] = await db
        .select({ product: products, vendor: vendors })
        .from(products)
        .innerJoin(vendors, eq(vendors.id, products.vendorId))
        .where(and(eq(products.id, variant.productId), isNull(products.deletedAt)))
        .limit(1);
      found = byVariant;
    }
  }
  if (!found) throw ApiError.notFound("محصول یافت نشد");

  const [images, cats] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, found.product.id))
      .orderBy(asc(productImages.position)),
    db
      .select({ slug: categories.slug })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(productCategories.productId, found.product.id)),
  ]);

  return {
    ...serializeProduct({ product: found.product, vendor: found.vendor, images, categories: cats }),
    description: found.product.description,
    dimensions: found.product.dimensions,
    material: found.product.material,
    color: found.product.color,
    sku: found.product.sku,
  };
}

export async function getVendorBySlug(slug: string) {
  const db = getDb();
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.slug, slug), eq(vendors.status, "active")))
    .limit(1);
  if (!vendor) throw ApiError.notFound("فروشگاه یافت نشد");
  return vendor;
}