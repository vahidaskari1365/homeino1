#!/usr/bin/env node
// ============================================================
// HOMEINO — Supabase migration runner
//
// Applies supabase/migrations/*.sql to the database pointed at by
// DATABASE_URL (a Supabase session-mode pooler URL is recommended:
// ...pooler.supabase.com:5432). Each file runs inside a transaction
// and is recorded in `public.schema_migrations`, so the command is
// idempotent and safe to re-run.
//
// Usage:
//   npm run db:migrate
//   DATABASE_URL=postgres://... node scripts/apply-supabase-migrations.mjs
// ============================================================
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("✗ DATABASE_URL is not set. Add it to .env or the environment.");
  process.exit(1);
}

// Supabase requires SSL. rejectUnauthorized:false matches Supabase's own
// `sslmode=require` connection strings (encrypt, don't verify CA).
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query("select filename from public.schema_migrations")).rows.map(
      (r) => r.filename,
    ),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`• ${file} — already applied`);
      skippedCount += 1;
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (filename) values ($1)",
        [file],
      );
      await client.query("commit");
      console.log(`✓ ${file} — applied`);
      appliedCount += 1;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error(`✗ ${file} — failed: ${err.message}`);
      process.exit(1);
    }
  }

  const { rows } = await client.query(
    "select count(*)::int as n from pg_tables where schemaname = 'public'",
  );
  console.log(`\nDone — ${appliedCount} applied, ${skippedCount} skipped.`);
  console.log(`public schema now contains ${rows[0].n} tables.`);
  await client.end();
}

main().catch(async (err) => {
  console.error("✗ migration run failed:", err.message);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
