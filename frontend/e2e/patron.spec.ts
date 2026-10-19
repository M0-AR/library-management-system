import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { BASE, PASSWORD, SLUG, stateFor, unique } from "./helpers";

let cachedToken = "";

function staffToken(): string {
  if (cachedToken) return cachedToken;
  const state = JSON.parse(fs.readFileSync(stateFor("admin"), "utf8")) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  const entry = state.origins[0].localStorage.find((item) => item.name === "lc.session.staff");
  if (!entry) throw new Error("admin storage state is missing the staff session");
  cachedToken = (JSON.parse(entry.value) as { accessToken: string }).accessToken;
  return cachedToken;
}

test.describe("patron account", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signs in, browses loans, places and cancels a hold", async ({ page, request }) => {
    const title = unique("E2E Patron Pick");
    const created = await request.post(`${BASE}/api/v1/books`, {
      headers: { Authorization: `Bearer ${staffToken()}` },
      data: { title, authors: ["Ada Patron"], categories: ["E2E"] },
    });
    expect(created.ok()).toBeTruthy();
    const body = (await created.json()) as { id?: string; data?: { id?: string } };
    expect(body.id ?? body.data?.id).toBeTruthy();

    await page.goto(`/library/${SLUG}/account`);
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("button", { name: "Loans", exact: true })).toBeVisible();
    await expect(page.getByText("Active loans", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Renew" }).first()).toBeVisible();

    await page.goto(`/library/${SLUG}`);
    await page.getByPlaceholder("Search the catalog…").fill(title);
    const card = page.locator(`a[href*="/books/"]`).filter({ hasText: title }).first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForURL(/\/books\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.getByRole("button", { name: /Place a hold|Join the waitlist/ }).click();
    await expect(page.getByRole("button", { name: /Hold placed|waitlist ✓/ })).toBeVisible();

    await page.goto(`/library/${SLUG}/account`);
    await page.getByRole("button", { name: "Holds", exact: true }).click();
    const holdCard = page.getByText(title, { exact: true }).locator("xpath=ancestor::div[contains(@class,'justify-between')][1]");
    await expect(holdCard).toBeVisible();
    await holdCard.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  });

  test("updates the profile phone number persistently", async ({ page }) => {
    await page.goto(`/library/${SLUG}/account`);
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("button", { name: "Fines", exact: true }).click();
    await expect(page.getByText(/No fines|fee$/).first()).toBeVisible();

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    const phone = `+1555${Date.now().toString().slice(-7)}`;
    await page.getByLabel("Phone").fill(phone);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Contact details updated")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByLabel("Phone")).toHaveValue(phone);
  });
});
