import { ok, demoUnavailable } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";
import { vendorEarningsSummary } from "@/services/vendorSettlement";
import { effectiveCommissionBp, vendorPackageState, activeProVendorCount } from "@/services/vendorPackage";
import { getDb } from "@/db";
import { vendorPayoutSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { vendorVerificationLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";

/** The vendor session: real membership + store + economics summary. */
export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("پنل فروشنده (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);

  const db = getDb();
  const [payoutSettings] = await db
    .select()
    .from(vendorPayoutSettings)
    .where(eq(vendorPayoutSettings.vendorId, ctx.vendor.id))
    .limit(1);
  const logs = await db
    .select({ action: vendorVerificationLogs.action, note: vendorVerificationLogs.note, createdAt: vendorVerificationLogs.createdAt })
    .from(vendorVerificationLogs)
    .where(eq(vendorVerificationLogs.vendorId, ctx.vendor.id))
    .orderBy(desc(vendorVerificationLogs.createdAt))
    .limit(10);

  // پکیج فروشنده — وضعیت اشتراک فعال (پلاس/سبک) + نرخ مؤثر کمیسیون.
  const pkg = await vendorPackageState(ctx.vendor.id);
  // سوشال پروف صادقانهٔ صفحهٔ پکیج (Task 59): شمارش واقعی فروشگاه‌های پلاسِ فعال.
  const proVendorsCount = await activeProVendorCount();

  return ok({
    vendor: {
      id: ctx.vendor.id,
      name: ctx.vendor.name,
      slug: ctx.vendor.slug,
      status: ctx.vendor.status,
      verificationStatus: ctx.vendor.verificationStatus,
      city: ctx.vendor.city,
      description: ctx.vendor.description,
      // نرخ پایهٔ per-vendor (null → پیش‌فرض پلتفرم). نرخ مؤثر حین اشتراک
      // پکیج در effectiveCommissionPercent می‌آید.
      commissionRatePercent: ctx.vendor.commissionRateBp === null ? null : ctx.vendor.commissionRateBp / 100,
      effectiveCommissionPercent: effectiveCommissionBp(ctx.vendor.commissionRateBp, pkg.slug) / 100,
      contactEmail: ctx.vendor.contactEmail,
      contactPhone: ctx.vendor.contactPhone,
    },
    member: { role: ctx.member.role, permissions: ctx.member.permissions ?? [] },
    summary: await vendorEarningsSummary(ctx.vendor.id),
    package: pkg,
    proVendorsCount,
    payoutSettings: payoutSettings
      ? { shaba: payoutSettings.shaba, cardNumber: payoutSettings.cardNumber, accountHolderName: payoutSettings.accountHolderName, payoutsEnabled: payoutSettings.payoutsEnabled }
      : null,
    verificationLog: logs,
  });
});
