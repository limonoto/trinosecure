import { test as setup } from "@playwright/test";

const STORAGE = "e2e/.artifacts/storage.json";

/** Log in once through Keycloak and persist the session for the authed tests. */
setup("authenticate", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Keycloak ile giriş yap/i }).click();
  await page.waitForURL("**/realms/trino-secure/**");
  await page.fill("#username", "admin");
  await page.fill("#password", "admin");
  await page.click("#kc-login");
  await page.waitForURL("http://localhost:3110/**");
  await page.context().storageState({ path: STORAGE });
});
