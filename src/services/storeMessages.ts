import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, storeMessages, users, vendors } from "@/db/schema";
import { notifyVendor } from "@/services/vendorNotifications";

// ============================================================
// HOMEINO — گفتگوی مشتری و فروشنده (Task 60 — درخواست مالک)
//
// «اگر خواستید برای پیام «پیغام جدید» بین مشتری و فروشنده هم چیزی بگذار»
// مشتری از صفحهٔ فروشگاه پیام می‌فرستد؛ پیامِ جدیدِ مشتری از طریق
// notifyVendor(kind: "customer_message") به صندوق اطلاع‌رسانی فروشنده
// (Task 59) می‌رود و مسیر SMS آن از همان‌جا آماده است — وقتی مالک پنل
// پیامک گرفت، همین پیام‌ها هم خودکار SMS می‌شوند (صفر تغییر کد).
//
// قرارداد صادقانگی: اعلان/SMS هرگز جریان اصلی را نمی‌شکند (notifyVendor
// fail-safe است)؛ شمارش خوانده‌نشدهٔ هر دو طرف از read_at واقعی می‌آید.
// ============================================================

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * پاکسازی بدنهٔ پیام (pure — تست‌شده): حذف فاصله‌های اضافی + سقف ۲۰۰۰ نویسه.
 * خروجی خالی یعنی پیام نامعتبر است (route خطا می‌دهد).
 */
export function normalizeMessageBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, MAX_MESSAGE_LENGTH);
}

export interface StoreMessageDto {
  id: string;
  senderRole: "customer" | "vendor";
  body: string;
  readAt: string | null;
  createdAt: string;
}

function toDto(row: typeof storeMessages.$inferSelect): StoreMessageDto {
  return {
    id: row.id,
    senderRole: row.senderRole === "vendor" ? "vendor" : "customer",
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function vendorIsActive(vendorId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ status: vendors.status })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);
  return row?.status === "active" || row?.status === "pending";
}

// ------------------------------------------------------------
// سمت مشتری — رشتهٔ گفتگوی من با این فروشگاه
// ------------------------------------------------------------

export async function getVendorIdBySlug(slug: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

/** رشتهٔ مشتری + خواندنِ پاسخ‌های فروشنده (read_at سمت مشتری ثبت می‌شود). */
export async function listCustomerThread(
  vendorId: string,
  customerId: string,
  opts: { markRead?: boolean } = {},
): Promise<{ items: StoreMessageDto[] }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(storeMessages)
    .where(and(eq(storeMessages.vendorId, vendorId), eq(storeMessages.customerId, customerId)))
    .orderBy(asc(storeMessages.createdAt))
    .limit(200);

  if (opts.markRead !== false) {
    await db
      .update(storeMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(storeMessages.vendorId, vendorId),
          eq(storeMessages.customerId, customerId),
          eq(storeMessages.senderRole, "vendor"),
          isNull(storeMessages.readAt),
        ),
      );
  }
  return { items: rows.map(toDto) };
}

/** ارسال پیام از مشتری + اعلان «پیغام جدید» برای فروشنده (شامل مسیر SMS). */
export async function sendCustomerMessage(input: {
  vendorId: string;
  customerId: string;
  body: string;
}): Promise<StoreMessageDto> {
  const db = getDb();
  if (!(await vendorIsActive(input.vendorId))) {
    throw new Error("vendor_not_available");
  }
  const [row] = await db
    .insert(storeMessages)
    .values({
      vendorId: input.vendorId,
      customerId: input.customerId,
      senderRole: "customer",
      body: input.body,
    })
    .returning();
  if (!row) throw new Error("insert_failed");

  // اعلان فروشنده — notifyVendor خودش fail-safe است (هرگز throw نمی‌کند)
  const preview = input.body.length > 140 ? `${input.body.slice(0, 140)}…` : input.body;
  await notifyVendor({
    vendorId: input.vendorId,
    kind: "customer_message",
    title: "پیام جدید از مشتری",
    body: preview,
    link: `/vendor/messages?customer=${input.customerId}`,
    meta: { customerId: input.customerId, messageId: row.id },
    smsText: `هومینو: پیام جدید از مشتری — ${preview.slice(0, 120)}`,
  });
  return toDto(row);
}

// ------------------------------------------------------------
// سمت فروشنده — رشته‌ها و پاسخ
// ------------------------------------------------------------

export interface VendorThreadSummary {
  customerId: string;
  customerName: string;
  customerEmail: string;
  lastBody: string;
  lastSenderRole: "customer" | "vendor";
  lastAt: string;
  unread: number;
}

/**
 * گروه‌بندی pure رشته‌ها برای تست — rows باید جدیدترین‌اول باشند.
 */
export function groupVendorThreads(
  rows: Array<{
    customerId: string;
    body: string;
    senderRole: string;
    readAt: Date | null;
    createdAt: Date;
  }>,
  customerMeta: Map<string, { name: string; email: string }>,
): VendorThreadSummary[] {
  const byCustomer = new Map<string, VendorThreadSummary>();
  for (const r of rows) {
    const existing = byCustomer.get(r.customerId);
    const meta = customerMeta.get(r.customerId);
    if (!existing) {
      byCustomer.set(r.customerId, {
        customerId: r.customerId,
        customerName: meta?.name?.trim() || "مشتری هومینو",
        customerEmail: meta?.email ?? "",
        lastBody: r.body,
        lastSenderRole: r.senderRole === "vendor" ? "vendor" : "customer",
        lastAt: r.createdAt.toISOString(),
        // fail-closed: هر senderRole غیر از vendor، پیامِ مشتری حساب می‌شود
        unread: r.senderRole !== "vendor" && !r.readAt ? 1 : 0,
      });
    } else if (r.senderRole !== "vendor" && !r.readAt) {
      existing.unread += 1;
    }
  }
  return [...byCustomer.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/** فهرست رشته‌های فروشنده — جدیدترین پیام اول، همراه خوانده‌نشدهٔ هر مشتری. */
export async function listVendorThreads(vendorId: string): Promise<{ items: VendorThreadSummary[] }> {
  const db = getDb();
  const rows = await db
    .select({
      customerId: storeMessages.customerId,
      body: storeMessages.body,
      senderRole: storeMessages.senderRole,
      readAt: storeMessages.readAt,
      createdAt: storeMessages.createdAt,
    })
    .from(storeMessages)
    .where(eq(storeMessages.vendorId, vendorId))
    .orderBy(desc(storeMessages.createdAt))
    .limit(1000);

  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const meta = new Map<string, { name: string; email: string }>();
  if (customerIds.length) {
    // نام نمایشی از profiles (نام کاربر اختیاری است) — ایمیل همیشه هست
    const userRows = await db
      .select({ id: users.id, name: profiles.name, email: users.email })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, customerIds));
    for (const u of userRows) meta.set(u.id, { name: u.name ?? "", email: u.email });
  }
  return { items: groupVendorThreads(rows, meta) };
}

/** رشتهٔ یک مشتری از دید فروشنده + ثبت خواندنِ پیام‌های مشتری. */
export async function listVendorThread(
  vendorId: string,
  customerId: string,
): Promise<{ items: StoreMessageDto[] }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(storeMessages)
    .where(and(eq(storeMessages.vendorId, vendorId), eq(storeMessages.customerId, customerId)))
    .orderBy(asc(storeMessages.createdAt))
    .limit(200);
  await db
    .update(storeMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(storeMessages.vendorId, vendorId),
        eq(storeMessages.customerId, customerId),
        eq(storeMessages.senderRole, "customer"),
        isNull(storeMessages.readAt),
      ),
    );
  return { items: rows.map(toDto) };
}

/** پاسخ فروشنده — فقط در رشتهٔ موجود (مشتری باید قبلاً پیام داده باشد). */
export async function sendVendorReply(input: {
  vendorId: string;
  customerId: string;
  body: string;
}): Promise<StoreMessageDto> {
  const db = getDb();
  const [thread] = await db
    .select({ id: storeMessages.id })
    .from(storeMessages)
    .where(and(eq(storeMessages.vendorId, input.vendorId), eq(storeMessages.customerId, input.customerId)))
    .limit(1);
  if (!thread) throw new Error("thread_not_found");

  const [row] = await db
    .insert(storeMessages)
    .values({
      vendorId: input.vendorId,
      customerId: input.customerId,
      senderRole: "vendor",
      body: input.body,
    })
    .returning();
  if (!row) throw new Error("insert_failed");
  return toDto(row);
}

/** شمارش کل خوانده‌نشدهٔ سمت فروشنده — برای badge آیندهٔ NAV. */
export async function unreadVendorMessageCount(vendorId: string): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(storeMessages)
    .where(
      and(
        eq(storeMessages.vendorId, vendorId),
        eq(storeMessages.senderRole, "customer"),
        isNull(storeMessages.readAt),
      ),
    );
  return Number(row?.count ?? 0);
}
