import { createReview, listProductReviews } from "@/services/reviewService";
import { requireUser } from "@/lib/api/auth";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard, readBody, parsePagination } from "@/lib/api/http";
import { validate, isInt, isOptionalString, isString } from "@/lib/api/validate";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts a product UUID or a catalog SLUG and resolves it to the DB id. */
async function resolveProductId(ref: string): Promise<string | null> {
  if (UUID_RE.test(ref)) return ref;
  const [row] = await getDb()
    .select({ id: products.id })
    .from(products)
    .where(or(eq(products.slug, ref)))
    .limit(1);
  return row?.id ?? null;
}

/** GET /api/reviews?product=<uuid|slug> — approved reviews for a product. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("نظرات (API)", "در حالت دمو، نظرات نمونه نمایش داده می‌شوند.");
  const ref = req.nextUrl.searchParams.get("product") ?? "";
  if (!ref) return ok({ items: [], meta: { page: 1, limit: 10, total: 0, hasMore: false } });
  const productId = await resolveProductId(ref);
  if (!productId) return ok({ items: [], meta: { page: 1, limit: 10, total: 0, hasMore: false } });
  const { page, limit } = parsePagination(req.nextUrl.searchParams);
  return ok(await listProductReviews(productId, page, limit));
});

/** POST /api/reviews — verified-purchase review (status: pending). */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("ثبت نظر (API)", "در حالت دمو، نظرات در مرورگر ذخیره می‌شوند.");
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, {
    productId: isString(160),
    rating: isInt(1, 5),
    title: isOptionalString(160),
    content: isOptionalString(2000),
  }) as { productId: string; rating: number; title?: string; content?: string };
  const productId = await resolveProductId(input.productId);
  if (!productId) return ok({ error: "محصول یافت نشد" }, { status: 404 });
  const review = await createReview(user.id, { ...input, productId });
  return ok(review, { status: 201 });
});
