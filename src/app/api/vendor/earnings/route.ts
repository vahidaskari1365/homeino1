import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vendorEarnings } from "@/db/schema";
import { requireVendorMember } from "@/lib/api/vendorAuth";
import { vendorEarningsSummary, vendorMonthEarningsSummary } from "@/services/vendorSettlement";

export const runtime = "nodejs";

/** Commission ledger for THIS vendor: summary + recent rows. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("درآمد فروشنده (API)");
  const ctx = await requireVendorMember(req);
  const { page: pageNum, limit } = parsePagination(new URL(req.url).searchParams);
  const offset = (pageNum - 1) * limit;
  const db = getDb();

  const rows = await db
    .select({
      id: vendorEarnings.id,
      orderId: vendorEarnings.orderId,
      grossToman: vendorEarnings.grossToman,
      commissionBp: vendorEarnings.commissionBp,
      commissionToman: vendorEarnings.commissionToman,
      netToman: vendorEarnings.netToman,
      status: vendorEarnings.status,
      availableAt: vendorEarnings.availableAt,
      settledAt: vendorEarnings.settledAt,
      createdAt: vendorEarnings.createdAt,
    })
    .from(vendorEarnings)
    .where(eq(vendorEarnings.vendorId, ctx.vendor.id))
    .orderBy(desc(vendorEarnings.createdAt))
    .limit(limit)
    .offset(offset);

  return ok({ summary: await vendorEarningsSummary(ctx.vendor.id), month: await vendorMonthEarningsSummary(ctx.vendor.id), items: rows });
});
