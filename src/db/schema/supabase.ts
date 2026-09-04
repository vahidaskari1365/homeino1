import {
  boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp,
  uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps, createdAtColumn } from "./_base";
import { users } from "./users";
import { vendors } from "./vendors";
import { products, productVariants } from "./products";
import { inspirations} from "./content";
import { aiDesigns, aiGenerations, creditAccounts, creditTransactions } from "./ai";

// Supabase-specific normalized entities used by the current storefront,
// account, marketplace and AI designer features.
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  language: varchar("language", { length: 16 }).notNull().default("fa"),
  currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
  theme: varchar("theme", { length: 24 }).notNull().default("system"),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  pushNotifications: boolean("push_notifications").notNull().default(true),
  personalization: jsonb("personalization").$type<Record<string, unknown>>().default({}),
  ...timestamps,
});

export const vendorProfiles = pgTable("vendor_profiles", {
  vendorId: uuid("vendor_id").primaryKey().references(() => vendors.id, { onDelete: "cascade" }),
  legalName: varchar("legal_name", { length: 180 }),
  registrationNumber: varchar("registration_number", { length: 80 }),
  taxId: varchar("tax_id", { length: 80 }),
  fulfilledOrders: integer("fulfilled_orders").notNull().default(0),
  responseRate: integer("response_rate").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const styles = pgTable("styles", {
  id: id(), slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(), nameEn: varchar("name_en", { length: 120 }),
  tagline: text("tagline"), shortDescription: text("short_description"), description: text("description"),
  image: text("image"), imageAlt: text("image_alt"), furnitureCharacteristics: text("furniture_characteristics"),
  lightingCharacteristics: text("lighting_characteristics"), formCharacteristics: text("form_characteristics"),
  decorCharacteristics: text("decor_characteristics"), visualDensity: text("visual_density"),
  suitableFor: text("suitable_for"), suitableRooms: jsonb("suitable_rooms").$type<string[]>().default([]),
  comparisonNote: text("comparison_note"), isPublished: boolean("is_published").notNull().default(false),
  ...timestamps,
}, t => [uniqueIndex("styles_slug_unique").on(t.slug)]);

export const styleFeatures = pgTable("style_features", {
  id: id(), styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
  feature: varchar("feature", { length: 240 }).notNull(), position: integer("position").notNull().default(0),
}, t => [index("style_features_style_idx").on(t.styleId)]);
export const styleMaterials = pgTable("style_materials", {
  styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
  material: varchar("material", { length: 120 }).notNull(), position: integer("position").notNull().default(0),
}, t => [primaryKey({ columns: [t.styleId, t.material] })]);
export const styleColors = pgTable("style_colors", {
  id: id(), styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(), hex: varchar("hex", { length: 9 }).notNull(),
  position: integer("position").notNull().default(0),
}, t => [index("style_colors_style_idx").on(t.styleId)]);

export const productAttributes = pgTable("product_attributes", {
  id: id(), productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(), value: text("value").notNull(),
  position: integer("position").notNull().default(0),
}, t => [index("product_attributes_product_idx").on(t.productId)]);
export const materials = pgTable("materials", {
  id: id(), slug: varchar("slug", { length: 100 }).notNull(), name: varchar("name", { length: 120 }).notNull(),
}, t => [uniqueIndex("materials_slug_unique").on(t.slug)]);
export const productMaterials = pgTable("product_materials", {
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "restrict" }),
  isPrimary: boolean("is_primary").notNull().default(false),
}, t => [primaryKey({ columns: [t.productId, t.materialId] }), index("product_materials_material_idx").on(t.materialId)]);

export const inspirationImages = pgTable("inspiration_images", {
  id: id(), inspirationId: uuid("inspiration_id").notNull().references(() => inspirations.id, { onDelete: "cascade" }),
  url: text("url").notNull(), alt: text("alt"), position: integer("position").notNull().default(0),
}, t => [index("inspiration_images_parent_idx").on(t.inspirationId)]);
export const inspirationStyles = pgTable("inspiration_styles", {
  inspirationId: uuid("inspiration_id").notNull().references(() => inspirations.id, { onDelete: "cascade" }),
  styleId: uuid("style_id").notNull().references(() => styles.id, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.inspirationId, t.styleId] })]);
export const inspirationProducts = pgTable("inspiration_products", {
  inspirationId: uuid("inspiration_id").notNull().references(() => inspirations.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, t => [primaryKey({ columns: [t.inspirationId, t.productId] }), index("inspiration_products_product_idx").on(t.productId)]);

export const aiGenerationInputs = pgTable("ai_generation_inputs", {
  id: id(), generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(), content: text("content"), metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: createdAtColumn,
}, t => [index("ai_generation_inputs_generation_idx").on(t.generationId)]);
export const aiGenerationOutputs = pgTable("ai_generation_outputs", {
  id: id(), generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(), content: text("content"), metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: createdAtColumn,
}, t => [index("ai_generation_outputs_generation_idx").on(t.generationId)]);
export const aiGenerationAssets = pgTable("ai_generation_assets", {
  id: id(), generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(), bucket: varchar("bucket", { length: 80 }).notNull(),
  objectPath: text("object_path").notNull(), mimeType: varchar("mime_type", { length: 100 }), sizeBytes: integer("size_bytes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}), createdAt: createdAtColumn,
}, t => [index("ai_generation_assets_generation_idx").on(t.generationId), index("ai_generation_assets_owner_idx").on(t.ownerId)]);

export const aiDesignRooms = pgTable("ai_design_rooms", {
  id: id(), designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(), roomType: varchar("room_type", { length: 80 }),
  sourceImagePath: text("source_image_path"), currentImagePath: text("current_image_path"), metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  ...timestamps,
}, t => [index("ai_design_rooms_design_idx").on(t.designId)]);
export const aiDesignProducts = pgTable("ai_design_products", {
  designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 40 }).notNull().default("user"), addedAt: createdAtColumn,
}, t => [primaryKey({ columns: [t.designId, t.productId] })]);
export const aiDesignOverlays = pgTable("ai_design_overlays", {
  id: id(), designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  roomId: uuid("room_id").references(() => aiDesignRooms.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  x: integer("x").notNull().default(50), y: integer("y").notNull().default(50), scale: integer("scale").notNull().default(100),
  rotation: integer("rotation").notNull().default(0), zIndex: integer("z_index").notNull().default(0), metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  ...timestamps,
}, t => [index("ai_design_overlays_design_idx").on(t.designId)]);
export const aiDesignHistory = pgTable("ai_design_history", {
  id: id(), designId: uuid("design_id").notNull().references(() => aiDesigns.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), label: varchar("label", { length: 160 }), snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAtColumn,
}, t => [uniqueIndex("ai_design_history_version_unique").on(t.designId, t.version)]);

export const aiConversations = pgTable("ai_conversations", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  designId: uuid("design_id").references(() => aiDesigns.id, { onDelete: "set null" }), title: varchar("title", { length: 200 }),
  ...timestamps,
}, t => [index("ai_conversations_user_idx").on(t.userId)]);
export const aiMessages = pgTable("ai_messages", {
  id: id(), conversationId: uuid("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), content: text("content").notNull(), metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: createdAtColumn,
}, t => [index("ai_messages_conversation_idx").on(t.conversationId)]);

export const creditPackages = pgTable("credit_packages", {
  id: id(), slug: varchar("slug", { length: 80 }).notNull(), name: varchar("name", { length: 120 }).notNull(),
  credits: integer("credits").notNull(), price: integer("price").notNull(), currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
  isActive: boolean("is_active").notNull().default(true), sortOrder: integer("sort_order").notNull().default(0), ...timestamps,
}, t => [uniqueIndex("credit_packages_slug_unique").on(t.slug)]);
export const creditUsage = pgTable("credit_usage", {
  id: id(), accountUserId: uuid("account_user_id").notNull().references(() => creditAccounts.userId, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id").notNull().references(() => creditTransactions.id, { onDelete: "restrict" }),
  generationId: uuid("generation_id").references(() => aiGenerations.id, { onDelete: "set null" }),
  credits: integer("credits").notNull(), operation: varchar("operation", { length: 120 }).notNull(), metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: createdAtColumn,
}, t => [uniqueIndex("credit_usage_transaction_unique").on(t.transactionId), index("credit_usage_generation_idx").on(t.generationId)]);
