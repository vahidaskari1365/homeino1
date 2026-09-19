import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, id, timestamps } from "./_base";
import { users } from "./users";
import { creditTransactions } from "./ai";

// ---------------------------------------------------------------
// Marketing growth engine — coupons, redemptions, expiring bonuses.
// Server-side only tables (RLS enabled, no client policies).
// ---------------------------------------------------------------

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: varchar("code", { length: 40 }).notNull(),
    description: text("description"),
    percentOff: integer("percent_off").notNull().default(0),
    packSlug: varchar("pack_slug", { length: 80 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    maxRedemptions: integer("max_redemptions"),
    maxPerUser: integer("max_per_user").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("coupons_code_unique").on(t.code)],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: id(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paymentRef: varchar("payment_ref", { length: 160 }).notNull(),
    amountOffIrr: integer("amount_off_irr").notNull().default(0),
    createdAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("coupon_redemptions_unique").on(t.couponId, t.paymentRef),
    index("coupon_redemptions_user_idx").on(t.userId),
    index("coupon_redemptions_coupon_idx").on(t.couponId),
  ],
);

/** Expiring bonus grants (welcome gift etc.) — sweeps subtract unused credits. */
export const creditBonusGrants = pgTable(
  "credit_bonus_grants",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => creditTransactions.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    expiredAmount: integer("expired_amount"),
    createdAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("credit_bonus_grants_tx_unique").on(t.transactionId),
    index("credit_bonus_grants_open_idx").on(t.userId),
  ],
);

export type Coupon = typeof coupons.$inferSelect;
export type CreditBonusGrant = typeof creditBonusGrants.$inferSelect;
