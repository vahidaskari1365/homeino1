import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id } from "./_base";
import { users } from "./users";
import { vendors } from "./vendors";

// ---------------------------------------------------------------
// Store messages — گفتگوی مشتری و فروشنده (Task 60 — درخواست مالک)
//
// «اگر خواستید برای پیام «پیغام جدید» بین مشتری و فروشنده هم چیزی بگذار»
// هر سطر = یک پیام در یک رشتهٔ گفتگوی (فروشگاه، مشتری). پیام جدیدِ مشتری
// از طریق notifyVendor(kind: "customer_message") به صندوق اطلاع‌رسانی
// فروشنده می‌رود و مسیر SMS آن هم از همان‌جا آماده است.
// ------------------------------------------------------------

export type StoreMessageRow = typeof storeMessages.$inferSelect;

export const storeMessages = pgTable(
  "store_messages",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** customer | vendor — فرستندهٔ پیام */
    senderRole: varchar("sender_role", { length: 10 }).notNull(),
    body: text("body").notNull(),
    /** null = گیرنده هنوز نخوانده (خواندن سمت گیرنده ثبت می‌شود) */
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("store_messages_thread_idx").on(t.vendorId, t.customerId, t.createdAt),
    // شمارش خوانده‌نشدهٔ سمت فروشنده — همیشه hot
    index("store_messages_vendor_unread_idx")
      .on(t.vendorId, t.customerId)
      .where(sql`read_at is null and sender_role = 'customer'`),
  ],
);
