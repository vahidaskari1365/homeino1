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
import { id, timestamps, createdAtColumn, updatedAtColumn } from "./_base";
import { products } from "./products";
import { users } from "./users";

// ---------------------------------------------------------------
// Editorial content — inspirations, projects, magazine
// ---------------------------------------------------------------
export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "published",
  "archived",
]);

export const inspirations = pgTable(
  "inspirations",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    image: text("image"),
    styleSlug: varchar("style_slug", { length: 48 }),
    room: varchar("room", { length: 60 }),
    tags: jsonb("tags").$type<string[]>().default([]),
    description: text("description"),
    productIds: jsonb("product_ids").$type<string[]>().default([]),
    content: jsonb("content").$type<Record<string, unknown>>().default({}),
    status: contentStatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: createdAtColumn,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("inspirations_slug_unique").on(t.slug),
    index("inspirations_status_idx").on(t.status),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    cover: text("cover"),
    description: text("description"),
    content: jsonb("content").$type<Record<string, unknown>>().default({}),
    status: contentStatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: createdAtColumn,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("projects_slug_unique").on(t.slug),
    index("projects_status_idx").on(t.status),
  ],
);

export const magazineArticles = pgTable(
  "magazine_articles",
  {
    id: id(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    excerpt: text("excerpt"),
    cover: text("cover"),
    body: text("body"),
    category: varchar("category", { length: 80 }),
    tags: jsonb("tags").$type<string[]>().default([]),
    status: contentStatusEnum("status").notNull().default("draft"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: createdAtColumn,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("magazine_articles_slug_unique").on(t.slug),
    index("magazine_articles_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------
// User collections (saved inspiration boards)
// ---------------------------------------------------------------
export const collections = pgTable(
  "collections",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 200 }),
    title: varchar("title", { length: 160 }).notNull(),
    subtitle: varchar("subtitle", { length: 240 }),
    image: text("image"),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("collections_user_idx").on(t.userId)],
);

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    addedAt: createdAtColumn,
  },
  (t) => [
    uniqueIndex("collection_items_pk").on(t.collectionId, t.productId),
    index("collection_products_product_idx").on(t.productId),
  ],
);

/** Backwards-compatible application alias; physical table is collection_products. */
export const collectionItems = collectionProducts;