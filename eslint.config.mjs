import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    rules: {
      // Data-URL / overlay / mock imagery cannot go through next/image without visual change.
      "@next/next/no-img-element": "off",
      // TypeScript already enforces unused locals/params (`noUnusedLocals` / `noUnusedParameters`).
      // The core ESLint rule mis-flags interface method signatures.
      "no-unused-vars": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // local workspace scratch (code reviews, tool output, uploads) — never linted
    ".zz-hr/**",
    ".zz-tr/**",
    "homeino_review/**",
    "tool-results/**",
    "upload/**",
    "download/**",
    // generated db-seed / verification bundles (npm run db:seed, agents:verify)
    ".seed-bundle.mjs",
    ".verify-bundle.mjs",
  ]),
]);
