#!/usr/bin/env node
// Execute a migration statement-by-statement (DO $$ blocks kept intact)
// and print the exact failing statement.
import { readFile } from "node:fs/promises";
import pg from "pg";

const file = process.argv[2];
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});
await client.connect();
const sql = await readFile(file, "utf8");

// Split into statements: track $$ dollar-quoting depth.
const stmts = [];
let cur = "", inDollar = false;
for (const line of sql.split("\n")) {
  cur += line + "\n";
  const ticks = (line.match(/\$\$/g) || []).length;
  for (let i = 0; i < ticks; i++) inDollar = !inDollar;
  if (!inDollar && line.trimEnd().endsWith(";")) { stmts.push(cur); cur = ""; }
}
if (cur.trim()) stmts.push(cur);

console.log(`statements: ${stmts.length}`);
let n = 0;
for (const s of stmts) {
  n++;
  if (!s.trim()) continue;
  try {
    await client.query(s);
  } catch (err) {
    console.log(`\n✗ statement #${n} FAILED: ${err.message} (code ${err.code})`);
    console.log("---- failing SQL ----");
    console.log(s.trim().slice(0, 600));
    await client.end().catch(() => {});
    process.exit(1);
  }
}
console.log("\nALL STATEMENTS OK");
await client.end();
