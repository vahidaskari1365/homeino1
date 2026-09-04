// ============================================================
// HOMEINO — runtime resolver for the "@/*" TypeScript path alias
//
// `tsc` type-checks and emits the test bundle but does NOT rewrite path
// aliases, so the compiled sources still `require("@/db")` and friends. This
// tiny CommonJS hook maps "@/x" to the compiled output ("…/ai-tests/src/x")
// and leaves every other request untouched — including scoped npm packages
// such as "@supabase/supabase-js".
//
// Used by `npm run test:ai` via `node -r ./scripts/ai-tests/alias.js …`.
// ============================================================
const path = require("node:path");
const Module = require("node:module");

const COMPILED_SRC = path.resolve(__dirname, "../../node_modules/.cache/ai-tests/src");
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function resolveWithAlias(request, ...rest) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(COMPILED_SRC, request.slice(2));
  }
  return originalResolve.call(this, request, ...rest);
};
