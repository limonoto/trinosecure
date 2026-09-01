import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a **production build** (`next build && next start`) and require the
 * local Postgres + Keycloak to be up (`docker compose up -d`, or the reused epes stack).
 *
 * Production build (not `next dev`) is deliberate: the Next.js 16 dev-tools overlay renders a
 * full-viewport `<nextjs-portal>` that intercepts pointer events over bottom-anchored buttons
 * (e.g. the rules drawer's "Kaydet"), which made two structured-editor specs flake in dev while
 * the feature works fine for real users. `next start` has no such overlay.
 *
 * - globalSetup seeds a deterministic `e2e-main` environment.
 * - The `setup` project logs in once (Keycloak) and saves the session.
 * - `guest` tests run signed-out; `chromium` tests reuse the saved session.
 *
 * Note: stop any `npm run dev` server on :3110 before running e2e (reuseExistingServer would
 * otherwise attach to the dev server and re-introduce the overlay).
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3110",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "guest", testMatch: /guest\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "chromium",
      testMatch: /core\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.artifacts/storage.json" },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3110",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
