import {
  uuid,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { id, softDelete, timestamps } from "./_base";
import { categories } from "./categories";
import { vendors } from "./vendors";

// ---------------------------------------------------------------
// Products — the catalog core
// ---------------------------------------------------------------
export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "out_of_stock",
  "archived",
]);

export const products = pgTable(
  "products",
  {
    id: id(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 400 }),
    price: integer("price").notNull().default(0),
    compareAtPrice: integer("compare_at_price"),
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    brand: varchar("brand", { length: 120 }),
    sku: varchar("sku", { length: 120 }),
    material: varchar("material", { length: 120 }),
    color: varchar("color", { length: 80 }),
    dimensions: jsonb("dimensions").$type<{
      width?: number;
      height?: number;
      depth?: number;
      unit?: string;
    }>().default({}),
    weight: integer("weight"),
    status: productStatusEnum("status").notNull().default("draft"),
    styleSlugs: jsonb("style_slugs").$type<string[]>().default([]),
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    rating: integer("rating").notNull().default(0), // 0..100 (x10 percent)
    reviewsCount: integer("reviews_count").notNull().default(0),
    salesCount: integer("sales_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("products_slug_unique").on(t.slug),
    index("products_vendor_idx").on(t.vendorId),
    index("products_status_price_idx").on(t.status, t.price),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("پیش‌فرض"),
    sku: varchar("sku", { length: 120 }),
    attributes: jsonb("attributes").$type<Record<string, string>>().default({}),
    priceDelta: integer("price_delta").notNull().default(0),
    image: text("image"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [
    uniqueIndex("product_categories_pk").on(t.productId, t.categoryId),
    index("product_categories_category_idx").on(t.categoryId),
  ],
);

export const productStyles = pgTable(
  "product_styles",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    styleSlug: varchar("style_slug", { length: 48 }).notNull(),
  },
  (t) => [
    uniqueIndex("product_styles_pk").on(t.productId, t.styleSlug),
    index("product_styles_slug_idx").on(t.styleSlug),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    warehouse: varchar("warehouse", { length: 60 }).notNull().default("main"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("inventory_product_variant_unique").on(t.productId, t.variantId),
    index("inventory_low_stock_idx").on(t.productId, t.quantity),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;