import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only working dirs (not application source):
    "designs/**",
    "docs/**",
    // E2E specs are type-checked/linted by Playwright's own tooling.
    "e2e/**",
  ]),
]);

export default eslintConfig;
