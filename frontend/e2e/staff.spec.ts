import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import { BASE, stateFor, unique } from "./helpers";

type Copy = { id: string; barcode: string; status: string };
type Row = Record<string, any>;

let cachedToken = "";

function adminToken(): string {
  if (cachedToken) return cachedToken;
  const state = JSON.parse(fs.readFileSync(stateFor("admin"), "utf8")) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  const entry = state.origins[0].localStorage.find((item) => item.name === "lc.session.staff");
  if (!entry) throw new Error("admin storage state is missing the staff session");
  cachedToken = (JSON.parse(entry.value) as { accessToken: string }).accessToken;
  return cachedToken;
}

function authHeaders(): { Authorization: string } {
  return { Authorization: `Bearer ${adminToken()}` };
}

function api(path: string): string {
  return `${BASE}/api/v1${path}`;
}

function unwrap(body: unknown): Row[] {
  if (Array.isArray(body)) return body;
  const record = body as Row;
  for (const key of ["items", "data", "results", "rows"]) {
    if (Array.isArray(record?.[key])) return record[key] as Row[];
  }
  return [];
}

async function copyStatus(request: APIRequestContext, bookId: string, barcode: string): Promise<string | undefined> {
  const response = await request.get(api(`/books/${bookId}/copies`), { headers: authHeaders() });
  if (!response.ok()) return undefined;
  const copies = unwrap(await response.json()) as Copy[];
  return copies.find((item) => item.barcode === barcode)?.status;
}

async function findAvailableCopy(request: APIRequestContext): Promise<{ bookId: string; copy: Copy }> {
  const response = await request.get(api("/books/search?q=e&limit=30"), { headers: authHeaders() });
  expect(response.ok()).toBeTruthy();
  const books = unwrap(await response.json());
  for (const book of books) {
    const copiesResponse = await request.get(api(`/books/${book.id}/copies`), { headers: authHeaders() });
    if (!copiesResponse.ok()) continue;
    const copies = unwrap(await copiesResponse.json()) as Copy[];
    const copy = copies.find((item) => item.status === "available");
    if (copy) return { bookId: book.id, copy };
  }
  throw new Error("no available copy found for checkout");
}

async function registerMember(page: Page, name: string, card: string): Promise<void> {
  await page.goto("/dashboard/members");
  await page.getByRole("button", { name: "Register member" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email").fill(`${card.toLowerCase()}@example.test`);
  await dialog.getByLabel("Card number").fill(card);
  await dialog.getByRole("button", { name: "Register" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("navigation matrix", () => {
  const matrix = [
    {
      role: "admin" as const,
      visible: ["Overview", "Catalog", "Members", "Circulation", "Holds", "Fines", "Messages", "Activity", "Branches", "Staff", "Settings"],
      hidden: [] as string[],
    },
    {
      role: "librarian" as const,
      visible: ["Overview", "Catalog", "Members", "Circulation", "Holds", "Fines", "Messages", "Branches"],
      hidden: ["Activity", "Staff", "Settings"],
    },
    {
      role: "assistant" as const,
      visible: ["Overview", "Catalog", "Members", "Circulation", "Holds", "Fines", "Branches"],
      hidden: ["Messages", "Activity", "Staff", "Settings"],
    },
  ];

  for (const entry of matrix) {
    test(`${entry.role} sees the right navigation`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: stateFor(entry.role) });
      const page = await context.newPage();
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
      const nav = page.getByRole("complementary");
      for (const label of entry.visible) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
      for (const label of entry.hidden) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
      }
      await context.close();
    });
  }
});

test.describe("catalog", () => {
  test.use({ storageState: stateFor("admin") });

  test("filters the seeded catalog by search", async ({ page }) => {
    await page.goto("/dashboard/books");
    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toBeVisible();
    const title = (await firstRow.locator("p").first().innerText()).trim();
    expect(title.length).toBeGreaterThan(0);
    await page.getByPlaceholder("Search title, author, ISBN…").fill(title);
    await expect(page.getByRole("row").filter({ hasText: title }).first()).toBeVisible();
  });

  test("adds a book through the dialog", async ({ page }) => {
    const title = unique("E2E Handbook");
    await page.goto("/dashboard/books");
    await page.getByRole("button", { name: "Add book" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog.getByLabel("Authors").fill("Ada Testwright, Grace Hopper");
    await dialog.getByLabel("Published year").fill("2025");
    await dialog.getByRole("button", { name: "Add book" }).click();
    await expect(dialog).toBeHidden();
    await page.getByPlaceholder("Search title, author, ISBN…").fill(title);
    await expect(page.getByText(title).first()).toBeVisible();
  });
});

test.describe("circulation", () => {
  test.use({ storageState: stateFor("admin") });

  test("registers a member, checks out a copy, and checks it back in", async ({ page, request }) => {
    const card = `E2E${Date.now().toString(36).toUpperCase()}`;
    await registerMember(page, unique("E2E Reader"), card);

    const { bookId, copy } = await findAvailableCopy(request);

    await page.goto("/dashboard/loans");
    await page.getByPlaceholder("Copy barcode (e.g. LIB-0001)").fill(copy.barcode);
    await page.getByPlaceholder("Member card number").fill(card);
    await page.getByRole("button", { name: "Check out" }).click();

    await expect
      .poll(() => copyStatus(request, bookId, copy.barcode), { timeout: 15_000 })
      .toBe("on_loan");

    await page.getByPlaceholder("Copy barcode", { exact: true }).fill(copy.barcode);
    await page.getByRole("button", { name: "Check in" }).click();

    await expect
      .poll(() => copyStatus(request, bookId, copy.barcode), { timeout: 15_000 })
      .toBe("available");
  });
});

test.describe("fines", () => {
  test.use({ storageState: stateFor("admin") });

  test("issues a fine and collects payment", async ({ page }) => {
    const card = `E2F${Date.now().toString(36).toUpperCase()}`;
    await registerMember(page, unique("E2E Debtor"), card);

    await page.goto("/dashboard/fines");
    await page.getByRole("button", { name: /add.*fine/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Member card number").fill(card);
    await dialog.getByLabel(/Amount/).fill("2.50");
    await dialog.getByLabel("Note").fill(unique("E2E damage charge"));
    await dialog.getByRole("button", { name: "Issue fine" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("row").filter({ hasText: card });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Collect" }).click();
    await page.getByRole("button", { name: "Paid", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: card }).getByText(/paid/i).first()).toBeVisible();
  });

  test("assistant cannot waive fines", async ({ browser }) => {
    const context = await browser.newContext({ storageState: stateFor("assistant") });
    const page = await context.newPage();
    await page.goto("/dashboard/fines");
    await expect(page.getByRole("heading", { name: "Fines" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Waive", exact: true })).toHaveCount(0);
    await context.close();
  });
});

test.describe("operations", () => {
  test.use({ storageState: stateFor("admin") });

  test("exports the loans CSV", async ({ page }) => {
    await page.goto("/dashboard/loans");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test("shows the audit trail on the activity page", async ({ page }) => {
    await page.goto("/dashboard/activity");
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });
});
