#!/usr/bin/env node
// Task 48 — inspect Supabase DB state (uses param-form connection, which works)
import pg from "pg";

const c = new pg.Client({
  host: "aws-1-eu-west-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.yydmibcmajxpqybtfgxm",
  password: process.env.SUPABASE_DB_PASSWORD || "",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await c.connect();

const cols = await c.query(
  "select column_name from information_schema.columns where table_schema='public' and table_name='schema_migrations' order by ordinal_position"
);
console.log("schema_migrations cols:", cols.rows.map((r) => r.column_name).join(", "));

const col = cols.rows[0]?.column_name;
if (col) {
  const m = await c.query(`select * from public.schema_migrations order by 1 limit 30`);
  console.log(`migration rows: ${m.rows.length}`);
  for (const r of m.rows) console.log("  *", JSON.stringify(r));
}

for (const t of ["users", "profiles", "products", "categories", "inspirations", "ai_providers", "credit_packages", "styles"]) {
  try {
    const r = await c.query(`select count(*)::int as n from public."${t}"`);
    console.log(`${t}: ${r.rows[0].n}`);
  } catch (e) {
    console.log(`${t}: ERR ${e.message.slice(0, 60)}`);
  }
}

// sample a product name to see if it's seeded with real content
try {
  const p = await c.query(`select name from public.products limit 3`);
  console.log("sample products:", p.rows.map((r) => r.name).join(" | "));
} catch {}

await c.end();
