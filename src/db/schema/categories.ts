import {
  uuid,
  timestamp,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_base";

// ---------------------------------------------------------------
// Categories — hierarchical (parent_id tree)
// Home
// ├── Furniture (Sofa, Table, Chair)
// ├── Lighting
// ├── Decoration
// └── Kitchen
// ---------------------------------------------------------------
export const categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: uuid("parent_id"),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    nameEn: varchar("name_en", { length: 120 }),
    description: text("description"),
    icon: varchar("icon", { length: 48 }),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    depth: integer("depth").notNull().default(0),
    path: varchar("path", { length: 500 }).default(""),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("categories_slug_unique").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
    index("categories_active_sort_idx").on(t.isActive, t.sortOrder),
  ],
);

export const categoryRelationTypeEnum = pgEnum("category_relation_type", [
  "parent",
  "child",
  "related",
]);

export const categoryRelations = pgTable(
  "category_relations",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    relatedCategoryId: uuid("related_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    relationType: categoryRelationTypeEnum("relation_type")
      .notNull()
      .default("related"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("category_relations_unique").on(
      t.categoryId,
      t.relatedCategoryId,
      t.relationType,
    ),
  ],
);

export type Category = typeof categories.$inferSelect;