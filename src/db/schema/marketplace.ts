import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_base";
import { vendors } from "./vendors";
import { orders, orderItems } from "./commerce";
import { users } from "./users";

// ---------------------------------------------------------------
// Marketplace settlement — commissions, vendor earnings, payouts.
// Money is integer Toman (see _base.ts convention); the payment
// gateway converts to IRR (×10) at the boundary.
// ---------------------------------------------------------------

export const vendorDocumentStatusEnum = pgEnum("vendor_document_status", [
  "pending",
  "approved",
  "rejected",
]);

/** KYC document kinds — open-ended varchar so new requirements don't need a migration. */
export const vendorDocuments = pgTable(
  "vendor_documents",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 60 }).notNull(), // national_id | business_license | tax_cert | brand_portfolio
    fileUrl: text("file_url").notNull(),
    fileName: varchar("file_name", { length: 200 }),
    status: vendorDocumentStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (t) => [index("vendor_documents_vendor_idx").on(t.vendorId, t.status)],
);

export const vendorVerificationActionEnum = pgEnum("vendor_verification_action", [
  "submitted",
  "approved",
  "rejected",
  "changes_requested",
  "suspended",
  "reactivated",
]);

/** Append-only audit trail of the verification workflow. */
export const vendorVerificationLogs = pgTable(
  "vendor_verification_logs",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    action: vendorVerificationActionEnum("action").notNull(),
    /** Admin user id — null for vendor-submitted entries. */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vendor_verification_logs_vendor_idx").on(t.vendorId, t.createdAt)],
);

export const vendorEarningStatusEnum = pgEnum("vendor_earning_status", [
  /** Order paid, item not delivered yet — not payable. */
  "pending",
  /** Item delivered — payable in the next payout run. */
  "available",
  /** Locked into a payout request awaiting admin settlement. */
  "settling",
  /** Money transferred to the vendor. */
  "paid",
  /** Order refunded — earning voided. */
  "reversed",
]);

/** Per-order-item commission ledger. One row per order item (idempotent). */
export const vendorEarnings = pgTable(
  "vendor_earnings",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    /** Gross item total in Toman (minus refunded amounts when reversed). */
    grossToman: integer("gross_toman").notNull(),
    /** Commission actually applied — snapshot, survives rate changes. */
    commissionBp: integer("commission_bp").notNull(),
    commissionToman: integer("commission_toman").notNull(),
    netToman: integer("net_toman").notNull(),
    status: vendorEarningStatusEnum("status").notNull().default("pending"),
    availableAt: timestamp("available_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // idempotency: one earning per order item, forever
    uniqueIndex("vendor_earnings_item_unique").on(t.orderItemId),
    index("vendor_earnings_vendor_status_idx").on(t.vendorId, t.status),
  ],
);

export const vendorPayoutStatusEnum = pgEnum("vendor_payout_status", [
  "requested",
  "approved",
  "paid",
  "rejected",
]);

/** A payout run: vendor-requested, admin-settled (manual/شبا or a future gateway). */
export const vendorPayouts = pgTable(
  "vendor_payouts",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    amountToman: integer("amount_toman").notNull(),
    status: vendorPayoutStatusEnum("status").notNull().default("requested"),
    method: varchar("method", { length: 40 }).notNull().default("manual"),
    /** Bank transfer tracking number / gateway reference. */
    reference: varchar("reference", { length: 120 }),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    processedBy: uuid("processed_by").references(() => users.id, { onDelete: "set null" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("vendor_payouts_vendor_idx").on(t.vendorId, t.createdAt)],
);

export const vendorPayoutItems = pgTable(
  "vendor_payout_items",
  {
    id: id(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => vendorPayouts.id, { onDelete: "cascade" }),
    earningId: uuid("earning_id")
      .notNull()
      .references(() => vendorEarnings.id, { onDelete: "cascade" }),
    amountToman: integer("amount_toman").notNull(),
  },
  (t) => [
    // an earning can belong to at most one payout, ever
    uniqueIndex("vendor_payout_items_earning_unique").on(t.earningId),
    index("vendor_payout_items_payout_idx").on(t.payoutId),
  ],
);

export type VendorEarning = typeof vendorEarnings.$inferSelect;
export type VendorPayout = typeof vendorPayouts.$inferSelect;
