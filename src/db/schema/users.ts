import {
  uuid,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_base";

// ---------------------------------------------------------------
// Users & identity
// ---------------------------------------------------------------
export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "vendor",
  "admin",
  "support",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "pending",
  "suspended",
]);

export const users = pgTable(
  "users",
  {
    // Supabase Auth is the identity source of truth. This id is populated from
    // auth.users.id by the on_auth_user_created database trigger.
    id: uuid("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    role: userRoleEnum("role").notNull().default("customer"),
    status: userStatusEnum("status").notNull().default("pending"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_role_idx").on(t.role),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }),
    avatar: text("avatar"),
    bio: text("bio"),
    preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}),
    locale: varchar("locale", { length: 16 }).notNull().default("fa"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Tehran"),
    ...timestamps,
  },
);

export const userAddresses = pgTable(
  "user_addresses",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 60 }),
    recipientName: varchar("recipient_name", { length: 120 }),
    phone: varchar("phone", { length: 32 }),
    province: varchar("province", { length: 60 }),
    city: varchar("city", { length: 60 }),
    address: text("address").notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("user_addresses_user_idx").on(t.userId)],
);

// ---- Shared scalar type helpers ----
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
