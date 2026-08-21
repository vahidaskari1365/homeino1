import { listProducts } from "@/services/catalogService";
import { ok } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";

export const runtime = "nodejs";

/** Search = the catalog query engine, exposed as its own route. */
export const GET = guard(async (req) => {
  const sp = req.nextUrl.searchParams;
  const { page, limit } = parsePagination(sp);
  const data = await listProducts({
    q: sp.get("q") ?? undefined,
    categorySlug: sp.get("category") ?? undefined,
    vendorSlug: sp.get("vendor") ?? undefined,
    styleSlug: sp.get("style") ?? undefined,
    minPrice: sp.get("minPrice") ? Number(sp.get("minPrice")) : undefined,
    maxPrice: sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined,
    inStockOnly: sp.get("inStock") === "true",
    sort: (sp.get("sort") as never) ?? undefined,
    page,
    limit,
  });
  return ok(data);
});