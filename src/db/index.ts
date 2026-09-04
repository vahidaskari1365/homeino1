import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

/**
 * The single DB pool for the server. Reused across hot reloads via globalThis.
 * All reads/writes go through Drizzle against `schema` — the repository layer
 * sits on top and never issues raw SQL.
 */
const globalForDb = globalThis as typeof globalThis & {
  __homeinoPool?: Pool;
};

export function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  globalForDb.__homeinoPool ??= new Pool({
    connectionString: databaseUrl,
    // Fail fast during build/prerender when DATABASE_URL is set but unreachable.
    connectionTimeoutMillis: 2_500,
    query_timeout: 2_500,
    idleTimeoutMillis: 10_000,
    max: 5,
  });
  return globalForDb.__homeinoPool;
}

export type DB = NodePgDatabase<typeof schema>;

export function getDb(): DB {
  return drizzle(getPool(), { schema });
}
