import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps, createdAtColumn} from "./_base";
import { products } from "./products";
import { productVariants } from "./products";
import { users } from "./users";
import { vendors } from "./vendors";

// ---------------------------------------------------------------
// Cart
// ---------------------------------------------------------------
export const cartStatusEnum = pgEnum("cart_status", [
  "active",
  "abandoned",
  "converted",
]);

export const carts = pgTable(
  "carts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: cartStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    // One ACTIVE cart per user. A partial index (not (user_id,status)) —
    // otherwise the 2nd successful order (2nd "converted" cart) would
    // violate the unique constraint and crash checkout.
    uniqueIndex("carts_active_user_unique")
      .on(t.userId)
      .where(sql`status = 'active'`),
    index("carts_user_idx").on(t.userId),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    priceSnapshot: integer("price_snapshot").notNull(), // price frozen at add time
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    addedAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("cart_items_unique").on(t.cartId, t.productId, t.variantId),
    index("cart_items_cart_idx").on(t.cartId),
  ],
);

// ---------------------------------------------------------------
// Orders — multi-vendor enabled (per-item vendor shipping stages)
// ---------------------------------------------------------------
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const itemStatusEnum = pgEnum("item_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    orderNumber: varchar("order_number", { length: 40 }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    subtotal: integer("subtotal").notNull().default(0),
    shippingTotal: integer("shipping_total").notNull().default(0),
    discountTotal: integer("discount_total").notNull().default(0),
    taxTotal: integer("tax_total").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    shippingAddress: jsonb("shipping_address").$type<Record<string, unknown>>(),
    billingAddress: jsonb("billing_address").$type<Record<string, unknown>>(),
    customerNote: text("customer_note"),
    placedAt: createdAtColumn,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_order_number_unique").on(t.orderNumber),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    // snapshots (order must survive catalog edits)
    titleSnapshot: text("title_snapshot").notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 120 }),
    imageSnapshot: text("image_snapshot"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull().default(1),
    total: integer("total").notNull().default(0),
    status: itemStatusEnum("status").notNull().default("pending"),
    refundedAmount: integer("refunded_amount").notNull().default(0),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_vendor_idx").on(t.vendorId),
    index("order_items_product_idx").on(t.productId),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    // text (not uuid): system actors like "payment:dev" / "user:<id>" are legal
    actorId: text("actor_id"),
    note: text("note"),
    createdAt: createdAtColumn,
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId)],
);

// ---------------------------------------------------------------
// Payments — provider abstraction, never hard-coded
// ---------------------------------------------------------------
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 140 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    paidAt: createdAtColumn,
    ...timestamps,
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_provider_ref_idx").on(t.provider, t.providerPaymentId),
  ],
);

export const paymentTxTypeEnum = pgEnum("payment_tx_type", [
  "authorize",
  "capture",
  "refund",
  "reversal",
]);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: id(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    type: paymentTxTypeEnum("type").notNull(),
    providerReference: varchar("provider_reference", { length: 140 }),
    amount: integer("amount").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: createdAtColumn,
  },
  (t) => [index("payment_transactions_payment_idx").on(t.paymentId)],
);

export const refundStatusEnum = pgEnum("refund_status", [
  "requested",
  "approved",
  "processed",
  "rejected",
]);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    reason: text("reason"),
    status: refundStatusEnum("status").notNull().default("requested"),
    processedBy: uuid("processed_by"),
    refundedAt: createdAtColumn,
    ...timestamps,
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

// ---------------------------------------------------------------
// Wishlist & Comparison
// ---------------------------------------------------------------
export const wishlists = pgTable(
  "wishlists",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("wishlists_user_unique").on(t.userId)],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    wishlistId: uuid("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    addedAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("wishlist_items_pk").on(t.wishlistId, t.productId),
    index("wishlist_items_product_idx").on(t.productId),
  ],
);

export const comparisonLists = pgTable("comparison_lists", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull().default("مقایسه"),
  ...timestamps,
});

export const comparisonItems = pgTable(
  "comparison_items",
  {
    comparisonListId: uuid("comparison_list_id")
      .notNull()
      .references(() => comparisonLists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    addedAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("comparison_items_pk").on(t.comparisonListId, t.productId),
  ],
);

// ---------------------------------------------------------------
// Reviews — only purchasers can leave verified reviews
// ---------------------------------------------------------------
export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(), // 1..5
    title: varchar("title", { length: 160 }),
    content: text("content"),
    verifiedPurchase: boolean("verified_purchase").notNull().default(false),
    helpfulCount: integer("helpful_count").notNull().default(0),
    status: reviewStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reviews_user_product_unique").on(t.userId, t.productId),
    index("reviews_product_status_idx").on(t.productId, t.status),
  ],
);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
