import { expect, test } from "@playwright/test";
import { PASSWORD, SLUG, stateFor } from "./helpers";

test.describe("mobile", () => {
  test.describe("public catalog", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("browses and opens a book", async ({ page }) => {
      await page.goto(`/library/${SLUG}`);
      await expect(page.getByPlaceholder("Search the catalog…")).toBeVisible();
      const card = page.locator(`a[href*="/books/"]`).first();
      await expect(card).toBeVisible();
      await card.click();
      await page.waitForURL(/\/books\//);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Place a hold|Join the waitlist|Hold placed|waitlist ✓/ }),
      ).toBeVisible();
    });

    test("signs in to the patron account", async ({ page }) => {
      await page.goto(`/library/${SLUG}/account`);
      await page.getByLabel("Email").fill("jane@example.com");
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("button", { name: "Loans", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Renew" }).first()).toBeVisible();
    });
  });

  test.describe("staff dashboard", () => {
    test.use({ storageState: stateFor("admin") });

    test("opens the navigation drawer", async ({ page }) => {
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name: "Catalog", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard\/books/);
      await expect(page.getByRole("heading", { name: "Catalog", exact: true })).toBeVisible();
    });
  });
});
