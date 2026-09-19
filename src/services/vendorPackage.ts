import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { vendorMembers, vendorSubscriptions, vendors } from "@/db/schema";
import { PLATFORM } from "@/config/platform";

// ============================================================
// HOMEINO — پکیج فروشنده (Task 58 + Task 59)
//
// اشتراک ماهانه که در طول اعتبار، «نرخ مؤثر» کمیسیون فروش را
// از نرخ پایهٔ پلتفرم (۹٪) به نرخِ همان پکیج کاهش می‌دهد.
// دو پله (Task 59): پلاس (۵٪ — ۲٬۲۸۰٬۰۰۰) و سبک (۷٪ — ۹۹۰٬۰۰۰).
//
// قراردادهای کلیدی:
//   • نرخ هرگز denormalize نمی‌شود — هنگام accrue، نرخِ مؤثرِ همان
//     لحظه از روی slug اشتراکِ فعال محاسبه و روی ردیف صورت‌حساب
//     snapshot می‌شود؛ انقضا خودکار.
//   • فعال‌سازی idempotent است (unique روی idempotencyKey) — retry
//     وب‌هوک هرگز دو اشتراک نمی‌سازد.
//   • تمدید قبل از انقضا: پنجرهٔ جدید از «انتهای اشتراک فعال فعلی» شروع
//     می‌شود (روزِ پرداخت‌شده هدر نمی‌رود) — نه از الان.
// ============================================================

export interface VendorPackageDef {
  slug: string;
  label: string;
  priceToman: number;
  durationDays: 30;
  commissionRatePercent: number;
  tagline: string;
}

export const PRO_COMMISSION_BP = PLATFORM.vendor.proPackage.commissionRatePercent * 100;
export const PRO_PACKAGE_PRICE_TOMAN = PLATFORM.vendor.proPackage.priceToman;
export const LIGHT_COMMISSION_BP = PLATFORM.vendor.lightPackage.commissionRatePercent * 100;
export const LIGHT_PACKAGE_PRICE_TOMAN = PLATFORM.vendor.lightPackage.priceToman;

/** کاتالوگ رسمی پکیج‌ها — تنها منبع حقیقت قیمت/نرخ (سرور، نه کلاینت). */
export const VENDOR_PACKAGE_CATALOG: VendorPackageDef[] = [
  { ...PLATFORM.vendor.proPackage },
  { ...PLATFORM.vendor.lightPackage },
];

const PACKAGE_BY_SLUG = new Map(VENDOR_PACKAGE_CATALOG.map((p) => [p.slug, p]));

/** slug معتبر → تعریف پکیج؛ نامعتبر → پکیج پلاس (پیش‌فرض محافظه‌کارانه). */
export function packageBySlug(slug: string | null | undefined): VendorPackageDef {
  if (slug && PACKAGE_BY_SLUG.has(slug)) return PACKAGE_BY_SLUG.get(slug)!;
  return PACKAGE_BY_SLUG.get(PLATFORM.vendor.proPackage.slug)!;
}

/** نرخ مؤثر کمیسیون بر حسب basis point برای یک پکیج فعال (pure). */
export function commissionBpForPackage(slug: string | null | undefined): number {
  return packageBySlug(slug).commissionRatePercent * 100;
}

/**
 * نرخ مؤثر کمیسیون: اشتراک فعال → نرخ پکیجِ همان slug؛ وگرنه نرخ per-vendor
 * ادمین‌تنظیم یا پیش‌فرض پلتفرم. (pure — قابل تست بدون DB)
 * ورودی دوم «slug پکیج فعال» است (null/undefined = بدون اشتراک).
 */
export function effectiveCommissionBp(
  vendorRateBp: number | null | undefined,
  activePackageSlug: string | null | undefined,
): number {
  if (activePackageSlug && PACKAGE_BY_SLUG.has(activePackageSlug)) {
    return PACKAGE_BY_SLUG.get(activePackageSlug)!.commissionRatePercent * 100;
  }
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

export function proExpiryFor(now: Date, activeExpiresAt?: Date | null, durationDays?: number): Date {
  const days = durationDays ?? PLATFORM.vendor.proPackage.durationDays;
  const start = proWindowStartFor(now, activeExpiresAt);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
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
  /** slug پکیج فعال — برای UI و نرخ مؤثر. */
  slug: string | null;
  label: string | null;
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
    .select({ expiresAt: vendorSubscriptions.expiresAt, packageSlug: vendorSubscriptions.packageSlug })
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
  const def = packageBySlug(row?.packageSlug);
  return {
    active: Boolean(row),
    slug: row ? def.slug : null,
    label: row ? def.label : null,
    expiresAt: row?.expiresAt?.toISOString() ?? null,
    priceToman: def.priceToman,
    commissionPercent: def.commissionRatePercent,
    baseCommissionPercent: PLATFORM.vendor.commissionRatePercent,
  };
}

/**
 * vendorIds → Map(vendorId → slug پکیج فعال). برای مسیر accrue — سبک و
 * تک‌کوئری. (جایگزین activeProVendorIds چند-پله‌ای)
 */
export async function activePackageSlugsFor(vendorIds: string[]): Promise<Map<string, string>> {
  if (!vendorIds.length) return new Map();
  const db = getDb();
  const rows = await db
    .selectDistinct({ vendorId: vendorSubscriptions.vendorId, packageSlug: vendorSubscriptions.packageSlug })
    .from(vendorSubscriptions)
    .where(
      and(
        inArray(vendorSubscriptions.vendorId, vendorIds),
        eq(vendorSubscriptions.status, "active"),
        gt(vendorSubscriptions.expiresAt, new Date()),
      ),
    );
  // چند اشتراک فعال برای یک فروشگاه غیرعادی است؛ جدیدترین بُرده — اما
  // selectDistinct ممکن است چند slug برگرداند، هر دو معتبرند: پلاس اولویت دارد.
  const map = new Map<string, string>();
  for (const r of rows) {
    const existing = map.get(r.vendorId);
    if (!existing) {
      map.set(r.vendorId, r.packageSlug);
    } else if (existing !== PLATFORM.vendor.proPackage.slug && r.packageSlug === PLATFORM.vendor.proPackage.slug) {
      map.set(r.vendorId, r.packageSlug);
    }
  }
  return map;
}

/** شمارش واقعی فروشگاه‌های پلاسِ فعال — سوشال پروف صادقانهٔ صفحهٔ پکیج (Task 59). */
export async function activeProVendorCount(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${vendorSubscriptions.vendorId})::int` })
    .from(vendorSubscriptions)
    .where(
      and(
        eq(vendorSubscriptions.packageSlug, PLATFORM.vendor.proPackage.slug),
        eq(vendorSubscriptions.status, "active"),
        gt(vendorSubscriptions.expiresAt, new Date()),
      ),
    );
  return Number(row?.count ?? 0);
}

/**
 * فعال‌سازی از روی پرداخت موفق — THE single fulfillment path (وب‌هوک
 * زرین‌پال و confirm دمو هر دو اینجا می‌رسند). Idempotent با unique index؛
 * retry → { duplicate: true } بدون ساخت سطر تازه.
 * Task 59: packageSlug پلهٔ خریداری‌شده را تعیین می‌کند (پلاس/سبک).
 */
export async function activateVendorPackage(input: {
  userId: string;
  provider: string;
  providerPaymentId: string;
  priceToman?: number;
  packageSlug?: string | null;
}): Promise<{ vendorId: string; expiresAt: Date; packageSlug: string; duplicate: boolean }> {
  const db = getDb();

  const vendorId = await vendorIdForUser(input.userId);
  if (!vendorId) {
    throw new Error("vendor_not_found");
  }

  const def = packageBySlug(input.packageSlug);
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

  const expiresAt = proExpiryFor(new Date(), current?.expiresAt, def.durationDays);
  const inserted = await db
    .insert(vendorSubscriptions)
    .values({
      vendorId,
      userId: input.userId,
      packageSlug: def.slug,
      priceToman: input.priceToman ?? def.priceToman,
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
    packageSlug: def.slug,
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
