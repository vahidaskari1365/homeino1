// ============================================================
// HOMEINO — Central DB schema entrypoint
// All domain modules are re-exported here so that `drizzle(pool, { schema })`
// and migrations see every table.
// ============================================================
export * from "./schema/_base";
export * from "./schema/users";
export * from "./schema/vendors";
export * from "./schema/categories";
export * from "./schema/products";
export * from "./schema/commerce";
export * from "./schema/ai";
export * from "./schema/content";
export * from "./schema/system";

import * as users from "./schema/users";
import * as vendors from "./schema/vendors";
import * as categories from "./schema/categories";
import * as products from "./schema/products";
import * as commerce from "./schema/commerce";
import * as ai from "./schema/ai";
import * as content from "./schema/content";
import * as system from "./schema/system";

/** Flat namespace of every table — consumes cleanly as the schema map. */
export const schema = {
  ...users,
  ...vendors,
  ...categories,
  ...products,
  ...commerce,
  ...ai,
  ...content,
  ...system,
};

export type { User, Profile, UserSession, NewUser } from "./schema/users";
export type { Vendor } from "./schema/vendors";
export type { Product, NewProduct } from "./schema/products";
export type { Order, OrderItem } from "./schema/commerce";
export type { AiGeneration } from "./schema/ai";
