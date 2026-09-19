import { ok, demoUnavailable, page } from "@/lib/api/response";
import { guard, readBody, parsePagination } from "@/lib/api/http";
import { validate, isString, isOptionalString, isInt, isOptionalInt } from "@/lib/api/validate";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { products, inventory, productImages } from "@/db/schema";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { slugify } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Vendor product catalog — list own products with inventory. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("محصولات فروشنده (API)");
  const ctx = await requireVendorMember(req);
  const { page: pageNum, limit } = parsePagination(new URL(req.url).searchParams);
  const offset = (pageNum - 1) * limit;
  const db = getDb();

  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      status: products.status,
      image: productImages.url,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      lowStockThreshold: inventory.lowStockThreshold,
    })
    .from(products)
    .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(eq(products.vendorId, ctx.vendor.id), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  return page(rows, { total: rows.length, page: pageNum, limit, hasMore: rows.length === limit });
});

/** Create a product for THIS vendor (status draft until admin/stock ready). */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("ایجاد محصول (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);
  const input = validate(await readBody(req), {
    title: isString(200),
    description: isOptionalString(8000),
    shortDescription: isOptionalString(400),
    price: isInt(0, 100_000_000_000),
    compareAtPrice: isOptionalInt(0, 100_000_000_000),
    brand: isOptionalString(120),
    material: isOptionalString(120),
    color: isOptionalString(80),
    quantity: isOptionalInt(0, 1_000_000),
    imageUrl: isOptionalString(1000),
  });
  if (input.title.trim().length < 3) throw ApiError.badRequest("عنوان محصول حداقل ۳ کاراکتر است");

  const db = getDb();
  const slug = await uniqueProductSlug(db, input.title);

  return db.transaction(async (tx) => {
    const [product] = await tx
      .insert(products)
      .values({
        vendorId: ctx.vendor.id,
        title: input.title.trim(),
        slug,
        description: input.description ?? null,
        shortDescription: input.shortDescription ?? null,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        brand: input.brand ?? ctx.vendor.name,
        material: input.material ?? null,
        color: input.color ?? null,
        status: "draft",
        currency: "IRT",
      })
      .returning({ id: products.id, slug: products.slug, status: products.status });

    await tx.insert(inventory).values({
      productId: product.id,
      quantity: input.quantity ?? 0,
    }).onConflictDoNothing();

    if (input.imageUrl) {
      await tx.insert(productImages).values({
        productId: product.id,
        url: input.imageUrl,
        isPrimary: true,
        position: 0,
      });
    }
    return ok(product, { status: 201 });
  });
});

async function uniqueProductSlug(db: ReturnType<typeof getDb>, title: string): Promise<string> {
  const base = slugify(title) || "product";
  let candidate = base.slice(0, 200);
  for (let i = 0; i < 20; i++) {
    const [hit] = await db.select({ id: products.id }).from(products).where(eq(products.slug, candidate)).limit(1);
    if (!hit) return candidate;
    candidate = `${base.slice(0, 190)}-${i + 2}`;
  }
  return `${base.slice(0, 180)}-${Date.now().toString(36)}`;
}
