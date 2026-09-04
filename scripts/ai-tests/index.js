// ============================================================
// HOMEINO — test entrypoint (`npm run test:ai`)
//
// 1. installs the "@/*" alias hook (tsc does not rewrite path aliases)
// 2. loads every compiled suite so node:test reports them in one run
//
// Suites live next to this file as *.test.ts and are compiled by
// scripts/ai-tests/tsconfig.json into node_modules/.cache/ai-tests.
// ============================================================
require("./alias.js");

const path = require("node:path");
const fs = require("node:fs");

const OUT_DIR = path.resolve(__dirname, "../../node_modules/.cache/ai-tests/scripts/ai-tests");
const suites = fs
  .readdirSync(OUT_DIR)
  .filter((file) => file.endsWith(".test.js"))
  .sort();

if (!suites.length) {
  console.error(`no compiled test suites found in ${OUT_DIR} — run "npm run test:ai" (it compiles first)`);
  process.exit(1);
}

for (const suite of suites) require(path.join(OUT_DIR, suite));
