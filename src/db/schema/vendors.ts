import {
  uuid,
  timestamp,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_base";
import { users } from "./users";

// ---------------------------------------------------------------
// Vendors — multi-vendor marketplace
// ---------------------------------------------------------------
export const vendorStatusEnum = pgEnum("vendor_status", [
  "pending",
  "active",
  "suspended",
  "rejected",
]);

export const vendorVerificationEnum = pgEnum("vendor_verification", [
  "unverified",
  "pending",
  "verified",
]);

export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    name: varchar("name", { length: 140 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    logo: text("logo"),
    cover: text("cover"),
    description: text("description"),
    status: vendorStatusEnum("status").notNull().default("pending"),
    verificationStatus: vendorVerificationEnum("verification_status")
      .notNull()
      .default("unverified"),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
    reviewsCount: integer("reviews_count").notNull().default(0),
    salesCount: integer("sales_count").notNull().default(0),
    followersCount: integer("followers_count").notNull().default(0),
    sinceYear: integer("since_year"),
    city: varchar("city", { length: 80 }),
    badges: jsonb("badges").$type<string[]>().default([]),
    shippingPolicy: text("shipping_policy"),
    returnPolicy: text("return_policy"),
    returnDays: integer("return_days").notNull().default(7),
    responseTime: varchar("response_time", { length: 60 }),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    website: text("website"),
    social: jsonb("social").$type<Record<string, string>>().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("vendors_slug_unique").on(t.slug),
    index("vendors_status_idx").on(t.status),
  ],
);

export const vendorMemberRoleEnum = pgEnum("vendor_member_role", [
  "owner",
  "manager",
  "staff",
]);

export const vendorMembers = pgTable(
  "vendor_members",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: vendorMemberRoleEnum("role").notNull().default("staff"),
    permissions: jsonb("permissions").$type<string[]>().default([]),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("vendor_members_vendor_user_unique").on(t.vendorId, t.userId),
  ],
);

export const vendorSettings = pgTable("vendor_settings", {
  vendorId: uuid("vendor_id")
    .primaryKey()
    .references(() => vendors.id, { onDelete: "cascade" }),
  currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
  autoConfirmOrders: boolean("auto_confirm_orders").notNull().default(true),
  dispatchTime: varchar("dispatch_time", { length: 80 }),
  shippingCoverage: varchar("shipping_coverage", { length: 120 }),
  shippingNote: text("shipping_note"),
  returnNote: text("return_note"),
  authenticityNote: text("authenticity_note"),
  notificationEmail: varchar("notification_email", { length: 320 }),
  orderNotesEnabled: boolean("order_notes_enabled").notNull().default(true),
  ...timestamps,
});

export const vendorPayoutSettings = pgTable("vendor_payout_settings", {
  vendorId: uuid("vendor_id")
    .primaryKey()
    .references(() => vendors.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 40 }).notNull().default("manual"),
  accountHolderName: varchar("account_holder_name", { length: 140 }),
  accountNumber: varchar("account_number", { length: 64 }),
  cardNumber: varchar("card_number", { length: 32 }),
  shaba: varchar("shaba", { length: 32 }),
  taxId: varchar("tax_id", { length: 32 }),
  payoutMethod: jsonb("payout_method").$type<Record<string, unknown>>().default({}),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  ...timestamps,
});

export type Vendor = typeof vendors.$inferSelect;