import { expect, test } from "@playwright/test";
import { LIBRARY_NAME, PASSWORD, SLUG, stateFor } from "./helpers";

test.describe("staff portal", () => {
  test("signs in through the UI and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Library slug").fill(SLUG);
    await page.getByLabel("Email").fill("admin@riverside.test");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Active loans")).toBeVisible();
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Library slug").fill(SLUG);
    await page.getByLabel("Email").fill("admin@riverside.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/incorrect|invalid|unable to sign in/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("platform portal", () => {
  test("signs in and shows the platform overview", async ({ page }) => {
    await page.goto("/platform/login");
    await page.getByLabel("Operator email").fill("platform@lms.test");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Enter console" }).click();
    await page.waitForURL(/\/platform$/);
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
  });
});

test.describe("seeded dashboard (stored admin session)", () => {
  test.use({ storageState: stateFor("admin") });

  test("shows the seeded KPIs without a login round-trip", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    for (const label of ["Active loans", "Ready holds", "Outstanding fines", "Members"]) {
      await expect(page.getByRole("main").getByText(label, { exact: true })).toBeVisible();
    }
  });
});

test.describe("public catalog (OPAC)", () => {
  test("renders the catalog without a session", async ({ page }) => {
    await page.goto(`/library/${SLUG}`);
    await expect(
      page.getByRole("banner").getByRole("link", { name: new RegExp(LIBRARY_NAME) }),
    ).toBeVisible();
    await expect(page.getByText(/\d+ books/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
  });

  test("patron session skips the account sign-in form", async ({ browser }) => {
    const context = await browser.newContext({ storageState: stateFor("patron") });
    const page = await context.newPage();
    await page.goto(`/library/${SLUG}/account`);
    await expect(page.getByText("Sign in to your account")).toHaveCount(0);
    await context.close();
  });
});
