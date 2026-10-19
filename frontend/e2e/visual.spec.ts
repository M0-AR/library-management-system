import { expect, test } from "@playwright/test";
import { SLUG, stateFor } from "./helpers";

test.describe("visual regression", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("staff login", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect(page).toHaveScreenshot("staff-login.png");
    });

    test("platform login", async ({ page }) => {
      await page.goto("/platform/login");
      await expect(page.getByRole("button", { name: "Enter console" })).toBeVisible();
      await expect(page).toHaveScreenshot("platform-login.png");
    });

    test("patron sign-in card", async ({ page }) => {
      await page.goto(`/library/${SLUG}/account`);
      await expect(page.getByText("Sign in to your account")).toBeVisible();
      await expect(page).toHaveScreenshot("patron-signin.png");
    });
  });

  test.describe("platform console", () => {
    test.use({ storageState: stateFor("platform") });

    test("overview", async ({ page }) => {
      await page.goto("/platform");
      await expect(page.getByRole("row").nth(1)).toBeVisible();
      await expect(page).toHaveScreenshot("platform-overview.png");
    });

    test("tenant detail", async ({ page }) => {
      await page.goto("/platform");
      await page.getByRole("link", { name: /Riverside Public Library/ }).first().click();
      await page.waitForURL(/\/platform\/tenants\//);
      await expect(page.getByRole("heading", { name: "Status", exact: true })).toBeVisible();
      await expect(page).toHaveScreenshot("platform-tenant.png");
    });
  });

  test.describe("dashboard", () => {
    test.use({ storageState: stateFor("admin") });

    test("branches", async ({ page }) => {
      await page.goto("/dashboard/branches");
      await expect(page.getByRole("heading", { name: "Branches", exact: true })).toBeVisible();
      await expect(page.getByText("Main Library", { exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot("dashboard-branches.png");
    });

    test("settings", async ({ page }) => {
      await page.goto("/dashboard/settings");
      await expect(page.getByRole("heading", { name: "General", exact: true })).toBeVisible();
      await expect(page.getByText(/displayed in USD/)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot("dashboard-settings.png");
    });
  });
});
