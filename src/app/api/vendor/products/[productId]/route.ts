import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isOptionalString, isOptionalInt, isOptionalEnum } from "@/lib/api/validate";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { products, inventory } from "@/db/schema";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ productId: string }> };

const OWN_PRODUCT = (vendorId: string, productId: string) =>
  and(eq(products.id, productId), eq(products.vendorId, vendorId), isNull(products.deletedAt));

/** Update price/description/stock/status of an OWN product. */
export const PATCH = guard(async (req, { params }: Params) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("ویرایش محصول (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);
  const { productId } = await params;

  const input = validate(await readBody(req), {
    title: isOptionalString(200),
    description: isOptionalString(8000),
    shortDescription: isOptionalString(400),
    price: isOptionalInt(0, 100_000_000_000),
    compareAtPrice: isOptionalInt(0, 100_000_000_000),
    quantity: isOptionalInt(0, 1_000_000),
    status: isOptionalEnum(["draft", "active", "out_of_stock", "archived"]),
  });

  const db = getDb();
  const [owned] = await db.select({ id: products.id }).from(products).where(OWN_PRODUCT(ctx.vendor.id, productId)).limit(1);
  if (!owned) throw ApiError.notFound("محصول یافت نشد");

  return db.transaction(async (tx) => {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.shortDescription !== undefined) patch.shortDescription = input.shortDescription;
    if (input.price !== undefined) patch.price = input.price;
    if (input.compareAtPrice !== undefined) patch.compareAtPrice = input.compareAtPrice;
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.publishedAt = input.status === "active" ? new Date() : null;
    }
    const [updated] = await tx.update(products).set(patch).where(eq(products.id, productId)).returning({
      id: products.id, title: products.title, price: products.price, status: products.status,
    });

    if (input.quantity !== undefined) {
      await tx.update(inventory).set({ quantity: input.quantity, updatedAt: new Date() }).where(eq(inventory.productId, productId));
    }
    return ok(updated);
  });
});

/** Soft-delete an own product (orders keep their snapshots). */
export const DELETE = guard(async (req, { params }: Params) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("حذف محصول (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);
  const { productId } = await params;
  const db = getDb();

  const [owned] = await db.select({ id: products.id }).from(products).where(OWN_PRODUCT(ctx.vendor.id, productId)).limit(1);
  if (!owned) throw ApiError.notFound("محصول یافت نشد");

  await db.update(products).set({ deletedAt: new Date(), status: "archived" }).where(eq(products.id, productId));
  return ok({ deleted: true });
});
