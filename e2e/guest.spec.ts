import { test, expect } from "@playwright/test";

test("redirects unauthenticated users to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/signin/);
  await expect(page.getByRole("button", { name: /Keycloak ile giriş yap/i })).toBeVisible();
});
