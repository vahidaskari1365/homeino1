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
// AI assets — original / generated / overlay / mask / thumbnail
// ---------------------------------------------------------------
export const aiAssetKindEnum = pgEnum("ai_asset_kind", [
  "original",
  "generated",
  "overlay",
  "mask",
  "thumbnail",
  "reference",
]);

export const aiAssets = pgTable(
  "ai_assets",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    kind: aiAssetKindEnum("kind").notNull(),
    mimeType: varchar("mime_type", { length: 64 }),
    sizeBytes: integer("size_bytes"),
    url: text("url").notNull(),
    storageProvider: varchar("storage_provider", { length: 40 }).notNull().default("local"),
    storageKey: text("storage_key"),
    width: integer("width"),
    height: integer("height"),
    checksum: varchar("checksum", { length: 64 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: createdAtColumn,
  },
  (t) => [
    index("ai_assets_owner_idx").on(t.ownerId),
    index("ai_assets_kind_idx").on(t.kind),
  ],
);

// ---------------------------------------------------------------
// AI designs — user-facing design sessions
// ---------------------------------------------------------------
export const aiDesignStatusEnum = pgEnum("ai_design_status", [
  "processing",
  "completed",
  "failed",
]);

export const aiDesigns = pgTable(
  "ai_designs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull().default("طراحی بدون نام"),
    mode: varchar("mode", { length: 40 }).notNull(),
    status: aiDesignStatusEnum("status").notNull().default("processing"),
    roomType: varchar("room_type", { length: 60 }),
    style: varchar("style", { length: 60 }),
    prompt: text("prompt"),
    originalImageId: uuid("original_image_id").references(() => aiAssets.id, {
      onDelete: "set null",
    }),
    currentImageId: uuid("current_image_id").references(() => aiAssets.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    creditsUsed: integer("credits_used").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("ai_designs_user_idx").on(t.userId),
    index("ai_designs_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------
// AI generations — one row per generation run (immutable facts)
// ---------------------------------------------------------------
export const aiGenerationStatusEnum = pgEnum("ai_generation_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    designId: uuid("design_id").references(() => aiDesigns.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    prompt: text("prompt"),
    intent: jsonb("intent").$type<{
      intent: string;
      target?: string;
      requestedChanges?: string[];
      preservedElements?: string[];
      style?: string | null;
      colors?: string[];
      confidence?: number;
    }>(),
    target: varchar("target", { length: 120 }),
    preservedElements: jsonb("preserved_elements").$type<string[]>().default([]),
    requestedChanges: jsonb("requested_changes").$type<string[]>().default([]),
    provider: varchar("provider", { length: 80 }),
    model: varchar("model", { length: 120 }),
    status: aiGenerationStatusEnum("status").notNull().default("queued"),
    inputAssetId: uuid("input_asset_id").references(() => aiAssets.id, {
      onDelete: "set null",
    }),
    outputAssetId: uuid("output_asset_id").references(() => aiAssets.id, {
      onDelete: "set null",
    }),
    overlayAssetId: uuid("overlay_asset_id").references(() => aiAssets.id, {
      onDelete: "set null",
    }),
    maskAssetId: uuid("mask_asset_id").references(() => aiAssets.id, {
      onDelete: "set null",
    }),
    overlayMetadata: jsonb("overlay_metadata").$type<{
      mask?: string;
      boundingBox?: number[];
      segmentation?: unknown;
      targetObject?: string;
      originalRegion?: number[];
      generatedRegion?: number[];
    }>(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    creditCost: integer("credit_cost").notNull().default(0),
    createdAt: createdAtColumn,
    completedAt: createdAtColumn,
  },
  (t) => [
    index("ai_generations_user_idx").on(t.userId),
    index("ai_generations_design_idx").on(t.designId),
    index("ai_generations_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------
// Credits — accounts, immutable ledger, usage
// ---------------------------------------------------------------
export const creditAccounts = pgTable("credit_accounts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeSpent: integer("lifetime_spent").notNull().default(0),
  version: integer("version").notNull().default(0), // optimistic lock
  updatedAt: updatedAtColumn,
});

export const creditTxTypeEnum = pgEnum("credit_tx_type", [
  "purchase",
  "generation",
  "refund",
  "bonus",
  "admin_adjustment",
  "expiration",
]);

export const creditTxStatusEnum = pgEnum("credit_tx_status", [
  "pending",
  "committed",
  "failed",
]);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: creditTxTypeEnum("type").notNull(),
    amount: integer("amount").notNull(), // signed; negative = spent
    balanceAfter: integer("balance_after").notNull(),
    operation: varchar("operation", { length: 120 }).notNull(),
    referenceType: varchar("reference_type", { length: 60 }),
    referenceId: uuid("reference_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    status: creditTxStatusEnum("status").notNull().default("committed"),
    note: text("note"),
    createdAt: createdAtColumn,
  },
  (t) => [
    index("credit_transactions_user_idx").on(t.userId),
    uniqueIndex("credit_transactions_idempotency_unique").on(t.idempotencyKey),
    index("credit_transactions_ref_idx").on(t.referenceType, t.referenceId),
  ],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => aiGenerations.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }),
    action: varchar("action", { length: 60 }).notNull(),
    creditCost: integer("credit_cost").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    createdAt: createdAtColumn,
  },
  (t) => [uniqueIndex("ai_usage_generation_unique").on(t.generationId)],
);

// ---------------------------------------------------------------
// AI providers / models / pricing — admin managed
// ---------------------------------------------------------------
export const aiProviderTypeEnum = pgEnum("ai_provider_type", [
  "LLM",
  "IMAGE",
  "OVERLAY",
]);

export const aiProviders = pgTable("ai_providers", {
  id: id(),
  name: varchar("name", { length: 80 }).notNull(),
  type: aiProviderTypeEnum("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  baseUrl: text("base_url"),
  // NOTE: never store API keys here — keys come from server-side env only.
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  healthStatus: varchar("health_status", { length: 24 }).notNull().default("unknown"),
  lastCheckedAt: createdAtColumn,
  ...timestamps,
});

export const aiModels = pgTable(
  "ai_models",
  {
    id: id(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => aiProviders.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    contextWindow: integer("context_window"),
    maxOutput: integer("max_output"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("ai_models_provider_name_unique").on(t.providerId, t.name)],
);

export const aiPricing = pgTable(
  "ai_pricing",
  {
    id: id(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => aiProviders.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => aiModels.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 60 }).notNull(), // e.g. room-redesign, image-edit
    unit: varchar("unit", { length: 32 }).notNull().default("per_generation"),
    price: integer("price").notNull().default(0), // credits
    currency: varchar("currency", { length: 8 }).notNull().default("IRR"),
    ...timestamps,
  },
  (t) => [index("ai_pricing_provider_model_idx").on(t.providerId, t.modelId)],
);

export type AiGeneration = typeof aiGenerations.$inferSelect;