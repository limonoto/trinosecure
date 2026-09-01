import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const { envId } = JSON.parse(readFileSync("e2e/.artifacts/seed.json", "utf8")) as { envId: string };

// Make the seeded environment the active one for every test.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "ts-active-env", value: envId, url: "http://localhost:3110" },
  ]);
});

test("environments: seeded env is listed and a new one can be created", async ({ page }) => {
  await page.goto("/environments");
  await expect(page.getByRole("cell", { name: "e2e-main" })).toBeVisible();

  await page.getByRole("button", { name: "Yeni ortam" }).click();
  await page.locator('input[name="name"]').fill("e2e-staging");
  await page.locator('input[name="configTarget"]').fill("/etc/trino/rules.json");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByRole("cell", { name: "e2e-staging" })).toBeVisible();
});

test("groups: create a group and add a member", async ({ page }) => {
  await page.goto("/groups");

  await page.getByRole("button", { name: "Yeni grup" }).click();
  await page.locator('input[name="name"]').fill("e2e-analysts");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("cell", { name: "e2e-analysts" })).toBeVisible();

  await page.getByRole("button", { name: "Üyeler" }).first().click();
  await page.locator("#member-username").fill("ali.veli");
  await page.getByRole("button", { name: "Ekle" }).click();
  await expect(page.getByText("ali.veli")).toBeVisible();
});

test("rules: edit raw JSON, save, and see the version in history", async ({ page }) => {
  await page.goto("/rules");

  await page.getByRole("tab", { name: "Ham JSON" }).click();
  const rules = JSON.stringify(
    { catalogs: [], schemas: [], tables: [{ group: "e2e-analysts", privileges: ["SELECT"] }] },
    null,
    2,
  );
  await page.locator("textarea").fill(rules);
  await page.getByRole("button", { name: "Uygula" }).click();
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByRole("button", { name: "Kaydedildi" })).toBeVisible();

  await page.goto("/history");
  await expect(page.getByText("aktif")).toBeVisible();
});

test("rules: add a table rule via the structured editor", async ({ page }) => {
  await page.goto("/rules");

  // The "Table kuralları" section's add button.
  await page.getByRole("button", { name: "Ekle" }).first().click();
  await page.locator('input[name="group"]').fill("e2e-readers");
  await page.locator('input[name="catalog"]').fill("analytics");
  await page.getByRole("checkbox").first().check(); // SELECT
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("e2e-readers")).toBeVisible();
});

test("rules: add an impersonation rule via the generic editor", async ({ page }) => {
  await page.goto("/rules");

  // A non-table section with a different field set (original/new user + allow boolean).
  const section = page.locator('[data-section="impersonation"]');
  await section.getByRole("button", { name: "Ekle" }).click();
  await page.locator('input[name="original_user"]').fill("svc_etl");
  await page.locator('input[name="new_user"]').fill("admin_$1");
  await page.getByRole("button", { name: "Kaydet" }).click();

  await expect(page.getByText("admin_$1")).toBeVisible();
});
