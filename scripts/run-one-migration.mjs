#!/usr/bin/env node
// Run one migration file and pinpoint the failing statement via err.position
import { readFile } from "node:fs/promises";
import pg from "pg";

const file = process.argv[2];
const cs = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });

await client.connect();
const sql = await readFile(file, "utf8");
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("OK — migration applied");
} catch (err) {
  await client.query("rollback").catch(() => {});
  const pos = Number(err.position || 0);
  console.log("ERROR:", err.message, "| code:", err.code, "| position:", pos);
  if (pos) {
    const start = Math.max(0, pos - 220);
    console.log("--- context around error position ---");
    console.log(sql.slice(start, pos + 120).replace(/\s+/g, " "));
    console.log("--- ^ ---");
  }
}
await client.end().catch(() => {});
