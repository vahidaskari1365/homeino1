#!/usr/bin/env node
// Probe Supabase Postgres connectivity:
//  1) direct db.<ref>.supabase.co:5432 (IPv6)
//  2) pooler aws-{0,1}-<region>.pooler.supabase.com:5432 (region discovery)
//
// Credentials come from the environment — never hardcode them:
//   SUPABASE_REF=yydmibcmajxpqybtfgxm SUPABASE_DB_PASSWORD='...' node scripts/probe-supabase.mjs
import pg from "pg";

const REF = process.env.SUPABASE_REF;
const PASS = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD ?? "");
if (!REF || !PASS) {
  console.error("Set SUPABASE_REF and SUPABASE_DB_PASSWORD in the environment.");
  process.exit(1);
}
const URLS = [
  ["direct-ipv6", `postgresql://postgres:${PASS}@db.${REF}.supabase.co:5432/postgres`],
];

const REGIONS = [
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2",
  "ap-northeast-1", "ap-northeast-2", "me-south-1", "me-central-1",
  "sa-east-1", "ca-central-1",
];
for (const aws of ["aws-1", "aws-0"]) {
  for (const r of REGIONS) {
    URLS.push([`${aws}-${r}`, `postgresql://postgres.${REF}:${PASS}@${aws}-${r}.pooler.supabase.com:5432/postgres`]);
  }
}

const good = [];
for (const [name, cs] of URLS) {
  const client = new pg.Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
    query_timeout: 4000,
  });
  const t0 = Date.now();
  try {
    await client.connect();
    const { rows } = await client.query("select current_database() as db, version() as v");
    good.push({ name, cs, ms: Date.now() - t0, db: rows[0].db });
    console.log(`✓ CONNECTED ${name} (${Date.now() - t0}ms) — ${rows[0].v.split(",")[0]}`);
    await client.end().catch(() => {});
    break; // first success wins
  } catch (err) {
    const msg = String(err.message || err).slice(0, 90);
    const interesting = /tenant|password|authentication/i.test(msg);
    console.log(`✗ ${name}: ${msg}${interesting ? "  <-- NOTABLE" : ""}`);
    await client.end().catch(() => {});
  }
}
if (!good.length) { console.log("\nNO CONNECTION FOUND"); process.exit(1); }
console.log(`\nWINNER=${good[0].name}\nCS=${good[0].cs.replace(PASS, "<pass>")}`);
