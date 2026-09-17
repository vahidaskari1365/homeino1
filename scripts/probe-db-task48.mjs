#!/usr/bin/env node
// Task 48 — probe Supabase DB: list tables + migration status
import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  "postgresql://postgres.yydmibcmajxpqybtfgxm:Vahid%400142%21%40%23@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const v = await client.query("select version() as v");
  console.log("✓ CONNECTED:", v.rows[0].v.split(",")[0]);

  const tables = await client.query(`
    select table_name from information_schema.tables
    where table_schema='public' order by table_name`);
  console.log(`\ntables in public: ${tables.rows.length}`);
  console.log(tables.rows.map((r) => "  - " + r.table_name).join("\n"));

  const mig = await client
    .query("select id from public.schema_migrations order by id")
    .catch(() => null);
  if (mig) {
    console.log(`\napplied migrations: ${mig.rows.length}`);
    console.log(mig.rows.map((r) => "  * " + r.id).join("\n"));
  } else {
    console.log("\nno schema_migrations table → migrations never applied");
  }

  // counts of key seed tables
  for (const t of ["profiles", "products", "categories"]) {
    try {
      const c = await client.query(`select count(*)::int as n from public."${t}"`);
      console.log(`${t}: ${c.rows[0].n} rows`);
    } catch {
      console.log(`${t}: (missing)`);
    }
  }
} catch (e) {
  console.error("✗ PROBE FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
