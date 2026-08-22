import { integer, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Shared column builders for the Homeino schema.
 * Every table gets stable ids + created/updated timestamps.
 */
export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Standalone created/updated columns for tables that need custom names. */
export const createdAtColumn = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAtColumn = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

/** Money is stored as an INTEGER in the base currency unit (Toman), never floats. */
export const money = (name: string) => integer(name).notNull().default(0);
export const moneyNullable = (name: string) => integer(name);