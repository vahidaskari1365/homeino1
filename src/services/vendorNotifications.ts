import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  orderItems,
  users,
  vendorMembers,
  vendorNotifications,
  vendors,
} from "@/db/schema";
import { getSmsProvider, normalizeIranMobile } from "@/services/notifications/sms";

// ============================================================
// HOMEINO — مرکز اطلاع‌رسانی فروشنده (Task 59 — درخواست مالک)
//
// «جایی باشه که به فروشنده پیغام بره» — هر رویداد مهم فروشگاه یک پیام
// درون‌سایتی می‌سازد و بلافاصله تلاشِ SMS هم می‌کند؛ تا مالک پنل پیامک
// بگیرد، تلاشِ SMS صادقانه «skipped» ثبت می‌شود و با ست‌کردن
// KAVENEGAR_API_KEY در Vercel بدون تغییر کد واقعی می‌شود.
//
// قرارداد: notifyVendor هرگز throw نمی‌کند — اعلان/پیامک هرگز نباید
// جریان اصلی (پرداخت، تسویه، فعال‌سازی پکیج) را بشکند.
// ============================================================

export type VendorNotificationKind =
  | "order_sold"
  | "payout"
  | "package"
  | "customer_message"
  | "platform_message";

export interface NotifyVendorInput {
  vendorId: string;
  kind: VendorNotificationKind;
  title: string;
  body?: string;
  link?: string;
  meta?: Record<string, unknown>;
  /** متن پیامک — پیش‌فرض از title+body ساخته می‌شود */
  smsText?: string;
}

/**
 * شمارهٔ موبایل فروشگاه برای پیامک: contactPhone فروشگاه، وگرنه موبایل
 * owner عضو فروشگاه. (null = هیچ شمارهٔ معتبری)
 */
export async function vendorSmsPhoneFor(vendorId: string): Promise<string | null> {
  const db = getDb();
  const [vendor] = await db
    .select({ contactPhone: vendors.contactPhone })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  const direct = normalizeIranMobile(vendor?.contactPhone);
  if (direct) return direct;

  const [owner] = await db
    .select({ phone: users.phone })
    .from(vendorMembers)
    .innerJoin(users, eq(users.id, vendorMembers.userId))
    .where(and(eq(vendorMembers.vendorId, vendorId), eq(vendorMembers.role, "owner")))
    .limit(1);
  return normalizeIranMobile(owner?.phone);
}

/** ارسال پیامک برای یک سطر اعلان — fail-safe و honest در sms_status. */
async function dispatchSms(notificationId: string, vendorId: string, text: string): Promise<void> {
  const db = getDb();
  try {
    const provider = getSmsProvider();
    if (!provider) {
      await db
        .update(vendorNotifications)
        .set({ smsStatus: "skipped", smsError: "no_sms_provider_configured" })
        .where(eq(vendorNotifications.id, notificationId));
      return;
    }
    const phone = await vendorSmsPhoneFor(vendorId);
    if (!phone) {
      await db
        .update(vendorNotifications)
        .set({ smsStatus: "no_phone", smsError: "no_valid_mobile_number_on_file" })
        .where(eq(vendorNotifications.id, notificationId));
      return;
    }
    const result = await provider.send(phone, text);
    await db
      .update(vendorNotifications)
      .set({
        smsStatus: result.ok ? "sent" : "failed",
        smsError: result.ok ? null : (result.error ?? "sms_send_failed"),
        smsSentAt: result.ok ? new Date() : null,
      })
      .where(eq(vendorNotifications.id, notificationId));
  } catch (err) {
    // حتی خودِ به‌روزرسانی وضعیت هم نباید بالادست را بشکند
    console.warn("[vendorNotifications] sms dispatch failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * یک پیام برای فروشگاه بساز + تلاش SMS. Idempotency مسئولیت caller است
 * (هوک‌ها فقط از مسیرهای idempotent صدا می‌شوند).
 */
export async function notifyVendor(input: NotifyVendorInput): Promise<{ id: string } | null> {
  try {
    const db = getDb();
    const [row] = await db
      .insert(vendorNotifications)
      .values({
        vendorId: input.vendorId,
        kind: input.kind,
        title: input.title.slice(0, 200),
        body: input.body ?? null,
        link: input.link ?? null,
        meta: input.meta ?? {},
      })
      .returning({ id: vendorNotifications.id });
    if (!row) return null;

    const smsText =
      input.smsText?.trim() ||
      [input.title, input.body].filter(Boolean).join("\n").slice(0, 600);
    // پیامک پس از ثبت سطر — await نمی‌خواهد fail شود؛ اما serverless است،
    // پس inline با کوتاه‌ترین مسیر می‌فرستیم (fail-safe داخلش).
    await dispatchSms(row.id, input.vendorId, smsText);
    return { id: row.id };
  } catch (err) {
    console.warn("[vendorNotifications] notifyVendor skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * «یک جنسی فروخت» → برای هر فروشگاهِ درگیر در سفارش یک پیام فروش جدید.
 * از orderItems گروه‌بندی‌شده — دادهٔ واقعی سفارش، نه تخمین.
 * از fulfillment صدا زده می‌شود (fail-safe).
 */
export async function notifyVendorsForOrder(orderId: string): Promise<{ notified: number }> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        vendorId: orderItems.vendorId,
        gross: sql<number>`sum(${orderItems.total} - coalesce(${orderItems.refundedAmount}, 0))::int`,
        itemCount: sql<number>`count(*)::int`,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .groupBy(orderItems.vendorId);

    let notified = 0;
    for (const r of rows) {
      const gross = Number(r.gross ?? 0);
      if (gross <= 0) continue;
      const res = await notifyVendor({
        vendorId: r.vendorId,
        kind: "order_sold",
        title: "فروش جدید ثبت شد",
        body: `سفارش شما با ${Number(r.itemCount)} قلم کالا به مبلغ ${gross.toLocaleString("fa-IR")} تومان ثبت شد. پس از تحویل، مبلغ خالص قابل تسویه می‌شود.`,
        link: "/vendor/orders",
        meta: { orderId, grossToman: gross, itemCount: Number(r.itemCount) },
        smsText: `هومینو: فروش جدید! مبلغ ${gross.toLocaleString("en-US")} تومان ثبت شد. جزئیات: homeino.ir/vendor`,
      });
      if (res) notified += 1;
    }
    return { notified };
  } catch (err) {
    console.warn("[vendorNotifications] order notify skipped:", err instanceof Error ? err.message : err);
    return { notified: 0 };
  }
}

/** فعال‌سازی پکیج فروشنده → پیام تأیید (از fulfillment). */
export async function notifyVendorPackageActivated(input: {
  vendorId: string;
  packageSlug: string;
  packageLabel: string;
  expiresAt: Date;
  commissionPercent: number;
}): Promise<void> {
  await notifyVendor({
    vendorId: input.vendorId,
    kind: "package",
    title: `پکیج ${input.packageLabel} فعال شد`,
    body: `کارمزد فروش شما تا ${input.expiresAt.toLocaleDateString("fa-IR")} به ${input.commissionPercent.toLocaleString("fa-IR")}٪ کاهش یافت.`,
    link: "/vendor/package",
    meta: { packageSlug: input.packageSlug, expiresAt: input.expiresAt.toISOString() },
    smsText: `هومینو: پکیج ${input.packageLabel} فعال شد — کارمزد فروش شما ${input.commissionPercent.toLocaleString("en-US")}٪ است.`,
  });
}

/** نتیجهٔ تسویه (تأیید/رد/واریز) → پیام (از adminPayoutAction پس از commit). */
export async function notifyVendorPayout(input: {
  vendorId: string;
  action: "approve" | "reject" | "mark_paid";
  amountToman: number;
  reference?: string | null;
}): Promise<void> {
  const map = {
    approve: {
      title: "درخواست تسویه تأیید شد",
      body: `درخواست تسویهٔ ${input.amountToman.toLocaleString("fa-IR")} تومانی شما تأیید شد و در نوبت واریز است.`,
      sms: `هومینو: درخواست تسویهٔ ${input.amountToman.toLocaleString("en-US")} تومانی شما تأیید شد.`,
    },
    reject: {
      title: "درخواست تسویه رد شد",
      body: `درخواست تسویهٔ ${input.amountToman.toLocaleString("fa-IR")} تومانی شما رد شد؛ مبلغ به موجودی قابل تسویه برگشت. جزئیات در پنل.`,
      sms: `هومینو: درخواست تسویهٔ ${input.amountToman.toLocaleString("en-US")} تومانی رد شد — مبلغ به موجودی برگشت.`,
    },
    mark_paid: {
      title: "تسویه واریز شد",
      body: `مبلغ ${input.amountToman.toLocaleString("fa-IR")} تومان به حساب شما واریز شد${input.reference ? ` — شماره پیگیری: ${input.reference}` : ""}.`,
      sms: `هومینو: ${input.amountToman.toLocaleString("en-US")} تومان تسویه واریز شد${input.reference ? ` — پیگیری: ${input.reference}` : ""}.`,
    },
  } as const;
  const m = map[input.action];
  await notifyVendor({
    vendorId: input.vendorId,
    kind: "payout",
    title: m.title,
    body: m.body,
    link: "/vendor/analytics",
    meta: { action: input.action, amountToman: input.amountToman, reference: input.reference ?? null },
    smsText: m.sms,
  });
}

/** صندوق پیام فروشگاه — جدیدترین اول، فیلتر خوانده‌نشده اختیاری. */
export async function listVendorNotifications(
  vendorId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ items: (typeof vendorNotifications.$inferSelect)[] }> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const where = opts.unreadOnly
    ? and(eq(vendorNotifications.vendorId, vendorId), isNull(vendorNotifications.readAt))
    : eq(vendorNotifications.vendorId, vendorId);
  const items = await db
    .select()
    .from(vendorNotifications)
    .where(where)
    .orderBy(desc(vendorNotifications.createdAt))
    .limit(limit);
  return { items };
}

/** شمارش خوانده‌نشده‌ها — برای badge. */
export async function unreadVendorNotificationCount(vendorId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendorNotifications)
    .where(and(eq(vendorNotifications.vendorId, vendorId), isNull(vendorNotifications.readAt)));
  return Number(row?.count ?? 0);
}

/** علامت‌گذاری خوانده‌شده — دسته‌ای یا همه. فقط پیام‌های همین فروشگاه. */
export async function markVendorNotificationsRead(
  vendorId: string,
  input: { ids?: string[]; all?: boolean },
): Promise<{ updated: number }> {
  const db = getDb();
  if (input.all) {
    const rows = await db
      .update(vendorNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(vendorNotifications.vendorId, vendorId), isNull(vendorNotifications.readAt)))
      .returning({ id: vendorNotifications.id });
    return { updated: rows.length };
  }
  const ids = (input.ids ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length) return { updated: 0 };
  const rows = await db
    .update(vendorNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(vendorNotifications.vendorId, vendorId), inArray(vendorNotifications.id, ids)))
    .returning({ id: vendorNotifications.id });
  return { updated: rows.length };
}
