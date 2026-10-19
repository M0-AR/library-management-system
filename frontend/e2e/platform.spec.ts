import { expect, test } from "@playwright/test";
import { stateFor } from "./helpers";

test.describe("platform console", () => {
  test.use({ storageState: stateFor("platform") });

  test("lists libraries, filters, and opens a tenant detail", async ({ page }) => {
    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible();

    await page.getByPlaceholder("Search by name or slug…").fill("riverside");
    const row = page.getByRole("row").filter({ hasText: "Riverside" });
    await expect(row).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Lakeside" })).toHaveCount(0);

    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/platform\/tenants\//);

    await expect(page.getByRole("heading", { name: "Status", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plan", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Circulation policy", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Branding", exact: true })).toBeVisible();
  });

  test("guards the console behind the platform login", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/platform");
    await expect(page).toHaveURL(/\/platform\/login/);
    await context.close();
  });
});
