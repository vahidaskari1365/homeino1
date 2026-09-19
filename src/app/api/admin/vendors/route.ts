import { demoUnavailable, page } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";
import { requireAdminUser } from "@/lib/api/auth";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { vendors, vendorMembers, users } from "@/db/schema";

export const runtime = "nodejs";

/** Admin vendor list — REAL rows (replaces the localStorage demo list). */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("مدیریت فروشنده‌ها (API)");
  await requireAdminUser(req);
  const { page: pageNum, limit } = parsePagination(new URL(req.url).searchParams);
  const offset = (pageNum - 1) * limit;
  const status = new URL(req.url).searchParams.get("status");
  const db = getDb();

  const conds = status && ["pending", "active", "suspended", "rejected"].includes(status) ? eq(vendors.status, status as never) : undefined;

  const rows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      slug: vendors.slug,
      status: vendors.status,
      verificationStatus: vendors.verificationStatus,
      city: vendors.city,
      commissionRateBp: vendors.commissionRateBp,
      rating: vendors.rating,
      salesCount: vendors.salesCount,
      createdAt: vendors.createdAt,
      ownerEmail: users.email,
      ownerId: users.id,
      pendingNetToman: sql<number>`(
        select coalesce(sum(e.net_toman), 0)::int from vendor_earnings e
        where e.vendor_id = vendors.id and e.status in ('pending','available','settling')
      )`,
    })
    .from(vendors)
    .leftJoin(vendorMembers, eq(vendorMembers.vendorId, vendors.id))
    .leftJoin(users, eq(users.id, vendorMembers.userId))
    .where(conds)
    .orderBy(desc(vendors.createdAt))
    .limit(limit)
    .offset(offset);

  return page(rows, { total: rows.length, page: pageNum, limit, hasMore: rows.length === limit });
});
