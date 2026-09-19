import { demoUnavailable, page } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";
import { requireAdminUser } from "@/lib/api/auth";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vendorPayouts, vendors } from "@/db/schema";

export const runtime = "nodejs";

/** Admin payout queue — every vendor payout request awaiting settlement. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("تسویه‌ها (مدیر)");
  await requireAdminUser(req);
  const { page: pageNum, limit } = parsePagination(new URL(req.url).searchParams);
  const offset = (pageNum - 1) * limit;
  const status = new URL(req.url).searchParams.get("status");
  const db = getDb();

  const conds = status && ["requested", "approved", "paid", "rejected"].includes(status) ? eq(vendorPayouts.status, status as never) : undefined;

  const rows = await db
    .select({
      id: vendorPayouts.id,
      vendorId: vendorPayouts.vendorId,
      vendorName: vendors.name,
      amountToman: vendorPayouts.amountToman,
      status: vendorPayouts.status,
      method: vendorPayouts.method,
      reference: vendorPayouts.reference,
      note: vendorPayouts.note,
      processedAt: vendorPayouts.processedAt,
      createdAt: vendorPayouts.createdAt,
    })
    .from(vendorPayouts)
    .innerJoin(vendors, eq(vendors.id, vendorPayouts.vendorId))
    .where(conds)
    .orderBy(desc(vendorPayouts.createdAt))
    .limit(limit)
    .offset(offset);

  return page(rows, { total: rows.length, page: pageNum, limit, hasMore: rows.length === limit });
});
