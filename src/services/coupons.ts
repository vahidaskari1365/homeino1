import { and, count, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { coupons, couponRedemptions } from "@/db/schema";

// ============================================================
// COUPON SERVICE — server-side validation only.
// Codes are NORMALIZED (uppercase, latin digits, no spaces) and
// every rule (window, pack scope, global/per-user caps, activity)
// is enforced here. The client can display prices, but the SERVER
// always recomputes the discount before creating a payment intent.
// ============================================================

export type CouponValidation =
  | { valid: true; code: string; couponId: string; percentOff: number; label: string }
  | { valid: false; reason: string };

/** Pure: uppercase, strip spaces/zero-width, Persian→latin digits. */
export function normalizeCouponCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s\u200c]+/g, "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** Pure: discount portion (IRR) of `priceIrr` for a percent — rounded half-up. */
export function couponDiscountIrr(priceIrr: number, percentOff: number): number {
  if (!Number.isFinite(priceIrr) || priceIrr <= 0) return 0;
  const pct = Math.min(100, Math.max(0, percentOff));
  return Math.round((priceIrr * pct) / 100);
}

/** Pure: final price after discount (never below 1 IRR). */
export function couponFinalIrr(priceIrr: number, percentOff: number): number {
  return Math.max(1, priceIrr - couponDiscountIrr(priceIrr, percentOff));
}

/** Validate a code for a given credit pack. Never throws — returns a reason. */
export async function validateCouponForPack(
  rawCode: string,
  packSlug?: string,
  userId?: string,
): Promise<CouponValidation> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { valid: false, reason: "کد تخفیف را وارد کن" };
  if (!process.env.DATABASE_URL) {
    return { valid: false, reason: "کد تخفیف در حالت دمو فعال نیست" };
  }
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, code), eq(coupons.isActive, true)))
      .limit(1);
    if (!row) return { valid: false, reason: "کد تخفیف معتبر نیست" };

    const now = new Date();
    if (row.startsAt && row.startsAt > now) {
      return { valid: false, reason: "این کمپین هنوز شروع نشده است" };
    }
    if (row.endsAt && row.endsAt < now) {
      return { valid: false, reason: "مهلت این کمپین تمام شده است" };
    }
    if (row.packSlug && packSlug && row.packSlug !== packSlug) {
      return { valid: false, reason: "این کد فقط برای بستهٔ خاصی فعال است" };
    }

    // Global cap
    if (row.maxRedemptions != null) {
      const [{ value: used }] = await db
        .select({ value: count() })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, row.id));
      if (used >= row.maxRedemptions) {
        return { valid: false, reason: "سهمیهٔ این کد تکمیل شده است" };
      }
    }

    // Per-user cap (only when we know the caller)
    if (userId) {
      const [{ value: mine }] = await db
        .select({ value: count() })
        .from(couponRedemptions)
        .where(and(eq(couponRedemptions.couponId, row.id), eq(couponRedemptions.userId, userId)));
      if (mine >= Math.max(1, row.maxPerUser)) {
        return { valid: false, reason: "قبلاً از این کد استفاده کرده‌ای" };
      }
    }

    return {
      valid: true,
      code: row.code,
      couponId: row.id,
      percentOff: row.percentOff,
      label: row.description ?? row.code,
    };
  } catch (err) {
    console.warn("[coupons] validation unavailable:", err instanceof Error ? err.message : err);
    return { valid: false, reason: "بررسی کد تخفیف ممکن نشد — بعداً تلاش کن" };
  }
}

/**
 * Record a redemption — IDEMPOTENT per (coupon, paymentRef) via unique index,
 * so webhook retries can never count a payment twice. Returns true when a NEW
 * row was inserted.
 */
export async function recordCouponRedemption(input: {
  couponId: string;
  userId: string;
  paymentRef: string;
  amountOffIrr: number;
}): Promise<boolean> {
  const db = getDb();
  const inserted = await db
    .insert(couponRedemptions)
    .values({
      couponId: input.couponId,
      userId: input.userId,
      paymentRef: input.paymentRef.slice(0, 160),
      amountOffIrr: Math.max(0, Math.round(input.amountOffIrr)),
    })
    .onConflictDoNothing()
    .returning({ id: couponRedemptions.id });
  return inserted.length > 0;
}

/** Remaining redemptions for a code (null = unlimited / unknown). */
export async function couponRemaining(code: string): Promise<number | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, normalizeCouponCode(code)), eq(coupons.isActive, true)))
      .limit(1);
    if (!row || row.maxRedemptions == null) return null;
    const [{ value: used }] = await db
      .select({ value: count() })
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, row.id));
    return Math.max(0, row.maxRedemptions - used);
  } catch {
    return null;
  }
}

/** The live campaign row for UI (from DB — the single source of truth). */
export async function activeCampaignByCode(rawCode: string): Promise<{
  active: boolean;
  code: string;
  percentOff: number;
  label: string;
  endsAt: string | null;
  remaining: number | null;
} | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = getDb();
    const now = new Date();
    const [row] = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, normalizeCouponCode(rawCode)),
          eq(coupons.isActive, true),
          or(isNull(coupons.endsAt), gt(coupons.endsAt, now)),
          or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
        ),
      )
      .limit(1);
    if (!row) return null;
    const remaining = await couponRemaining(row.code);
    return {
      active: remaining === null ? true : remaining > 0,
      code: row.code,
      percentOff: row.percentOff,
      label: row.description ?? row.code,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      remaining,
    };
  } catch {
    return null;
  }
}
