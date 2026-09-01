import { execFileSync } from "node:child_process";

/**
 * Runs once before the e2e suite. Seeds deterministic data via a tsx subprocess
 * (e2e/seed.ts) so the generated Prisma client's ESM module loads correctly.
 */
export default function globalSetup() {
  execFileSync("npx", ["--yes", "tsx", "e2e/seed.ts"], { stdio: "inherit" });
}
