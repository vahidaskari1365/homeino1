import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody, parsePagination } from "@/lib/api/http";
import { validate, isOptionalInt, isOptionalString } from "@/lib/api/validate";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vendorPayouts } from "@/db/schema";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { requestPayout, vendorEarningsSummary } from "@/services/vendorSettlement";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Payout history for THIS vendor. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("تسویه‌ها (API)");
  const ctx = await requireVendorMember(req);
  const { page: pageNum, limit } = parsePagination(new URL(req.url).searchParams);
  const offset = (pageNum - 1) * limit;
  const db = getDb();

  const rows = await db
    .select({
      id: vendorPayouts.id,
      amountToman: vendorPayouts.amountToman,
      status: vendorPayouts.status,
      method: vendorPayouts.method,
      reference: vendorPayouts.reference,
      processedAt: vendorPayouts.processedAt,
      createdAt: vendorPayouts.createdAt,
    })
    .from(vendorPayouts)
    .where(eq(vendorPayouts.vendorId, ctx.vendor.id))
    .orderBy(desc(vendorPayouts.createdAt))
    .limit(limit)
    .offset(offset);

  return ok({ items: rows, summary: await vendorEarningsSummary(ctx.vendor.id) });
});

/** Request a payout of the available (delivered, unsettled) earnings. */
export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("درخواست تسویه (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);
  const input = validate(await readBody(req), {
    amountToman: isOptionalInt(1, 100_000_000_000),
    note: isOptionalString(500),
  });

  const result = await requestPayout({
    vendorId: ctx.vendor.id,
    requestedBy: ctx.userId,
    amountToman: input.amountToman,
    note: input.note,
  });
  if (!result.ok) {
    if (result.reason === "below_minimum") {
      throw ApiError.badRequest(`حداقل مبلغ تسویه ${result.minToman?.toLocaleString("fa-IR")} تومان است`);
    }
    if (result.reason === "insufficient") {
      throw ApiError.badRequest("مبلغ درخواستی بیشتر از موجودی قابل تسویه است");
    }
    throw ApiError.badRequest("موجودی قابل تسویه‌ای وجود ندارد — ابتدا سفارش‌ها باید تحویل شوند");
  }
  return ok(result, { status: 201 });
});
