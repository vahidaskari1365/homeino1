import { and, asc, count, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  categories,
  inventory,
  productCategories,
  productImages,
  productStyles,
  productVariants,
  products,
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

/** Map a product row + joined images/categories/variants/vendor into a catalog DTO.
 *  Colors come from the REAL per-color variants (name + attributes.hex) so the
 *  agents and the storefront see the same palette the vendor configured.
 *  subCategorySlug is derived from the linked CHILD category (parentId set) —
 *  without it the agents' structured sub-category filters match nothing. */
export function serializeProduct(row: {
  product: typeof products.$inferSelect;
  vendor?: typeof vendors.$inferSelect;
  images?: { url: string; alt: string | null; isPrimary: boolean }[];
  categories?: { slug: string; parentId?: string | null }[];
  variants?: { name: string; attributes: Record<string, string> | null }[];
}) {
  const p = row.product;
  const variantColors = (row.variants ?? [])
    .map((v) => ({ name: String(v.name ?? "").trim(), hex: String(v.attributes?.hex ?? "").trim() }))
    .filter((c) => c.name && c.name !== "پیش‌فرض");
  const colors: { name: string; hex: string }[] = [];
  for (const c of variantColors) if (!colors.some((x) => x.name === c.name)) colors.push(c);
  if (!colors.length && p.color) colors.push({ name: p.color, hex: "" });
  const linkedCategories = row.categories ?? [];
  const subCategorySlug = linkedCategories.find((c) => c.parentId != null)?.slug;
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
    sku: p.sku ?? undefined,
    material: p.material ?? undefined,
    color: p.color ?? undefined,
    colors,
    subCategorySlug: subCategorySlug ?? undefined,
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
    createdAt: p.createdAt,
  };
}

export async function listProducts(query: CatalogQuery = {}) {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 12));
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
        .select({ productId: productCategories.productId, slug: categories.slug, parentId: categories.parentId })
        .from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(inArray(productCategories.productId, productIds))
    : [];

  const byProduct = (pid: string) => images.filter((i) => i.productId === pid);
  const catsByProduct = (pid: string) => cats.filter((c) => c.productId === pid);

  // Per-color variants → real color names + hexes for the catalog DTO.
  const variants = productIds.length
    ? await db
        .select({ productId: productVariants.productId, name: productVariants.name, attributes: productVariants.attributes })
        .from(productVariants)
        .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)))
    : [];
  const variantsByProduct = (pid: string) => variants.filter((v) => v.productId === pid);

  const total = totalRows[0]?.n ?? 0;
  return {
    items: rows.map((r) =>
      serializeProduct({
        product: r.product,
        vendor: r.vendor,
        images: byProduct(r.product.id),
        categories: catsByProduct(r.product.id),
        variants: variantsByProduct(r.product.id),
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

  const [images, cats, variants] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, row.product.id))
      .orderBy(asc(productImages.position)),
    db
      .select({ slug: categories.slug, parentId: categories.parentId })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(eq(productCategories.productId, row.product.id)),
    db
      .select({ name: productVariants.name, attributes: productVariants.attributes })
      .from(productVariants)
      .where(and(eq(productVariants.productId, row.product.id), eq(productVariants.isActive, true))),
  ]);

  // available quantity from inventory (real inventory, not frontend state)
  const [inv] = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.productId, row.product.id), isNull(inventory.variantId)))
    .limit(1);

  return {
    ...serializeProduct({ product: row.product, vendor: row.vendor, images, categories: cats, variants }),
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
  type CatNode = (typeof rows)[number] & { children: CatNode[] };
  const byId = new Map<string, CatNode>();
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [] });
  }
  const roots: CatNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    if (row.parentId && byId.has(row.parentId)) {
      byId.get(row.parentId)!.children.push(node);
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