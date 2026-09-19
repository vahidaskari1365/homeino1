import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { vendorMembers, vendorSubscriptions, vendors } from "@/db/schema";
import { PLATFORM } from "@/config/platform";

// ============================================================
// HOMEINO — پکیج فروشنده (Task 58)
//
// یک اشتراک ماهانه که در طول اعتبار، «نرخ مؤثر» کمیسیون فروش را
// از نرخ پایهٔ پلتفرم (۹٪) به ۵٪ کاهش می‌دهد.
//
// قراردادهای کلیدی:
//   • نرخ هرگز denormalize نمی‌شود — هنگام accrue، نرخِ مؤثرِ همان
//     لحظه محاسبه و روی ردیف صورت‌حساب snapshot می‌شود؛ انقضا خودکار.
//   • فعال‌سازی idempotent است (unique روی idempotencyKey) — retry
//     وب‌هوک هرگز دو اشتراک نمی‌سازد.
//   • تمدید قبل از انقضا: پنجرهٔ جدید از «انتهای اشتراک فعال فعلی» شروع
//     می‌شود (روزِ پرداخت‌شده هدر نمی‌رود) — نه از الان.
// ============================================================

export const PRO_COMMISSION_BP = PLATFORM.vendor.proPackage.commissionRatePercent * 100;
export const PRO_PACKAGE_PRICE_TOMAN = PLATFORM.vendor.proPackage.priceToman;

/**
 * نرخ مؤثر کمیسیون: اشتراک پلاس فعال → نرخ پکیج؛ وگرنه نرخ per-vendor
 * ادمین‌تنظیم یا پیش‌فرض پلتفرم. (pure — قابل تست بدون DB)
 */
export function effectiveCommissionBp(
  vendorRateBp: number | null | undefined,
  proActive: boolean,
): number {
  if (proActive) return PRO_COMMISSION_BP;
  if (vendorRateBp === null || vendorRateBp === undefined) {
    return PLATFORM.vendor.commissionRatePercent * 100;
  }
  if (vendorRateBp < 0 || vendorRateBp > 10_000) {
    return PLATFORM.vendor.commissionRatePercent * 100;
  }
  return vendorRateBp;
}

/**
 * شروع پنجرهٔ تمدید: اگر اشتراک فعلی هنوز فعال است، از انقضای آن ادامه
 * بده (روزِ خریده‌شده هدر نمی‌رود)؛ وگرنه از الان. (pure)
 */
export function proWindowStartFor(now: Date, activeExpiresAt: Date | null | undefined): Date {
  if (activeExpiresAt && activeExpiresAt.getTime() > now.getTime()) return activeExpiresAt;
  return now;
}

export function proExpiryFor(now: Date, activeExpiresAt?: Date | null): Date {
  const start = proWindowStartFor(now, activeExpiresAt);
  return new Date(start.getTime() + PLATFORM.vendor.proPackage.durationDays * 24 * 60 * 60 * 1000);
}

/** شناسهٔ idempotency یک پرداخت درگاه → کلید دفتر اشتراک. */
export function proIdempotencyKey(provider: string, providerPaymentId: string): string {
  return `vpro:${provider}:${providerPaymentId}`;
}

/** فروشگاهِ متصل به کاربر (اولین membership) — برای فعال‌سازی از روی پرداخت. */
export async function vendorIdForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ vendorId: vendorMembers.vendorId })
    .from(vendorMembers)
    .where(eq(vendorMembers.userId, userId))
    .limit(1);
  return row?.vendorId ?? null;
}

export interface ProPackageState {
  active: boolean;
  expiresAt: string | null;
  priceToman: number;
  commissionPercent: number;
  baseCommissionPercent: number;
}

/**
 * وضعیت پکیج برای پنل فروشنده — «فعال» یعنی پنجرهٔ فعالِ نگذشته وجود دارد.
 * (سطرهای cancelled یا گذشته هرگز فعال شمرده نمی‌شوند.)
 */
export async function vendorPackageState(vendorId: string): Promise<ProPackageState> {
  const db = getDb();
  const [row] = await db
    .select({ expiresAt: vendorSubscriptions.expiresAt })
    .from(vendorSubscriptions)
    .where(
      and(
        eq(vendorSubscriptions.vendorId, vendorId),
        eq(vendorSubscriptions.status, "active"),
        gt(vendorSubscriptions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(vendorSubscriptions.expiresAt))
    .limit(1);
  return {
    active: Boolean(row),
    expiresAt: row?.expiresAt?.toISOString() ?? null,
    priceToman: PRO_PACKAGE_PRICE_TOMAN,
    commissionPercent: PLATFORM.vendor.proPackage.commissionRatePercent,
    baseCommissionPercent: PLATFORM.vendor.commissionRatePercent,
  };
}

/** vendorId → اشتراک فعال هست؟ (برای مسیر accrue — سبک و تک‌کوئری) */
export async function activeProVendorIds(vendorIds: string[]): Promise<Set<string>> {
  if (!vendorIds.length) return new Set();
  const db = getDb();
  const rows = await db
    .selectDistinct({ vendorId: vendorSubscriptions.vendorId })
    .from(vendorSubscriptions)
    .where(
      and(
        inArray(vendorSubscriptions.vendorId, vendorIds),
        eq(vendorSubscriptions.status, "active"),
        gt(vendorSubscriptions.expiresAt, new Date()),
      ),
    );
  return new Set(rows.map((r) => r.vendorId));
}

/**
 * فعال‌سازی از روی پرداخت موفق — THE single fulfillment path (وب‌هوک
 * زرین‌پال و confirm دمو هر دو اینجا می‌رسند). Idempotent با unique index؛
 * retry → { duplicate: true } بدون ساخت سطر تازه.
 */
export async function activateVendorPackage(input: {
  userId: string;
  provider: string;
  providerPaymentId: string;
  priceToman?: number;
}): Promise<{ vendorId: string; expiresAt: Date; duplicate: boolean }> {
  const db = getDb();

  const vendorId = await vendorIdForUser(input.userId);
  if (!vendorId) {
    throw new Error("vendor_not_found");
  }

  const idempotencyKey = proIdempotencyKey(input.provider, input.providerPaymentId);
  const [current] = await db
    .select({ expiresAt: vendorSubscriptions.expiresAt, status: vendorSubscriptions.status })
    .from(vendorSubscriptions)
    .where(
      and(
        eq(vendorSubscriptions.vendorId, vendorId),
        eq(vendorSubscriptions.status, "active"),
        gt(vendorSubscriptions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(vendorSubscriptions.expiresAt))
    .limit(1);

  const expiresAt = proExpiryFor(new Date(), current?.expiresAt);
  const inserted = await db
    .insert(vendorSubscriptions)
    .values({
      vendorId,
      userId: input.userId,
      packageSlug: PLATFORM.vendor.proPackage.slug,
      priceToman: input.priceToman ?? PRO_PACKAGE_PRICE_TOMAN,
      status: "active",
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      startedAt: new Date(),
      expiresAt,
      idempotencyKey,
    })
    .onConflictDoNothing({ target: vendorSubscriptions.idempotencyKey })
    .returning({ id: vendorSubscriptions.id });

  return {
    vendorId,
    expiresAt,
    duplicate: inserted.length === 0,
  };
}

/** نام فروشگاه برای نمایش — fail-safe. */
export async function vendorNameFor(vendorId: string): Promise<string | null> {
  try {
    const db = getDb();
    const [row] = await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    return row?.name ?? null;
  } catch {
    return null;
  }
}
