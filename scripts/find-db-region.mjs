#!/usr/bin/env node
// Task 48 — find the correct Supabase pooler region by trial auth
import pg from "pg";

const REF = "yydmibcmajxpqybtfgxm";
const PASSWORD = process.argv[2] || process.env.SUPABASE_DB_PASSWORD || "";
const USER = `postgres.${REF}`;

const regions = [];
for (const r of ["ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2",
  "ap-south-1","us-east-1","us-east-2","us-west-1","us-west-2","eu-central-1",
  "eu-west-1","eu-west-2","eu-west-3","ca-central-1","sa-east-1","me-central-1"]) {
  regions.push(`aws-0-${r}`, `aws-1-${r}`);
}

let found = null;
for (const host of regions.map((h) => `${h}.pooler.supabase.com`)) {
  const t0 = Date.now();
  const client = new pg.Client({
    host, port: 5432, database: "postgres", user: USER, password: PASSWORD,
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    const q = await client.query("select current_user, inet_server_addr()::text as ip");
    console.log(`✓✓✓ AUTH OK @ ${host} (${Date.now() - t0}ms) user=${q.rows[0].current_user} ip=${q.rows[0].ip}`);
    found = host;
    await client.end();
    break;
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = (e.message || "").slice(0, 90).replace(/\n/g, " ");
    console.log(`✗ ${host} (${ms}ms) ${e.code || ""} ${msg}`);
    await client.end().catch(() => {});
  }
}

if (found) {
  const url = `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${found}.pooler.supabase.com:5432/postgres`;
  console.log("\nDATABASE_URL (session pooler):");
  console.log(url);
} else {
  console.log("\n✗ no region accepted credentials");
  process.exitCode = 1;
}
