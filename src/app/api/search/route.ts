import { listProducts } from "@/services/catalogService";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";
import { optionalUser } from "@/lib/api/auth";
import { recordEvent } from "@/services/workflows/triggers";
import { parseToman } from "@/lib/utils";

export const runtime = "nodejs";

/** Search = the catalog query engine, exposed as its own route. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("جستجوی API", "در حالت دمو، جستجو روی کاتالوگ نمونهٔ محلی انجام می‌شود و این API پس از راه‌اندازی دیتابیس فعال می‌شود.");
  const sp = req.nextUrl.searchParams;
  const { page, limit } = parsePagination(sp);
  const data = await listProducts({
    q: sp.get("q") ?? undefined,
    categorySlug: sp.get("category") ?? undefined,
    vendorSlug: sp.get("vendor") ?? undefined,
    styleSlug: sp.get("style") ?? undefined,
    // Price params accept every human format: «۵۰٬۰۰۰٬۰۰۰», «50,000,000»,
    // «۵۰،۰۰۰،۰۰۰» (keyboard comma) — parseToman never yields NaN, so a bad
    // value can no longer silently drop the price filter.
    minPrice: parseToman(sp.get("minPrice")),
    maxPrice: parseToman(sp.get("maxPrice")),
    inStockOnly: sp.get("inStock") === "true",
    sort: (sp.get("sort") as never) ?? undefined,
    page,
    limit,
  });

  // The recommendation pipeline's biggest starvation gap was «search is
  // invisible». Every real query now lands in analytics_events (+ memory).
  const q = sp.get("q");
  if (q && q.trim().length >= 2) {
    try {
      const identity = await optionalUser(req);
      await recordEvent({
        eventType: "product_search",
        entityType: "search",
        entityId: q.trim().slice(0, 60),
        userId: identity.userId,
        sessionId: sp.get("sessionId") ?? req.cookies.get("homeino_session_id")?.value ?? null,
        path: "/search",
        metadata: { q: q.trim().slice(0, 120), results: Array.isArray(data?.items) ? data.items.length : null },
      });
    } catch { /* analytics must never break search */ }
  }
  return ok(data);
});