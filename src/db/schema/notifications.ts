import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { id } from "./_base";
import { vendors } from "./vendors";

// ---------------------------------------------------------------
// Vendor notifications — صندوق پیام فروشنده (Task 59)
// هر سطر = یک پیام برای فروشگاه + دفتر وضعیت SMS آن.
// ------------------------------------------------------------

export type VendorNotificationRow = typeof vendorNotifications.$inferSelect;

export const vendorNotifications = pgTable(
  "vendor_notifications",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    /** order_sold | payout | package | platform_message — باز برای پیام‌های آینده */
    kind: varchar("kind", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    /** مسیر درون‌سایتی برای کلیک (مثلاً /vendor/orders) */
    link: varchar("link", { length: 300 }),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    /** null = خوانده‌نشده */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** pending | sent | failed | skipped | no_phone */
    smsStatus: varchar("sms_status", { length: 20 }).notNull().default("pending"),
    smsError: text("sms_error"),
    smsSentAt: timestamp("sms_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vendor_notifications_vendor_idx").on(t.vendorId, t.createdAt),
  ],
);
