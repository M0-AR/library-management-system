import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  registerTenant,
  resetDb,
  setupLibrary,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("dashboard", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  async function fixture() {
    const activeBook = await createBook(session.token, { title: "Active Book" });
    const archivedBook = await createBook(session.token, { title: "Archived Book" });
    const holdBook = await createBook(session.token, { title: "Hold Book" });
    await (await api())
      .post(`/api/v1/books/${archivedBook.id}/status`)
      .set(session.headers)
      .send({ status: "archived" });

    const activeCopies = await addCopies(session.token, activeBook.id, branchId, 2);
    await addCopies(session.token, holdBook.id, branchId, 1);

    const borrower = await createMember(session.token, { fullName: "Dash Borrower" });
    const suspended = await createMember(session.token, { fullName: "Dash Suspended" });
    await (await api())
      .patch(`/api/v1/members/${suspended.id}`)
      .set(session.headers)
      .send({ status: "suspended" });

    const checkout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: borrower.id, copyId: activeCopies[0].id });
    expect(checkout.status).toBe(201);

    await (await api())
      .post("/api/v1/holds")
      .set(session.headers)
      .send({ bookId: holdBook.id, memberId: borrower.id });

    await (await api())
      .post("/api/v1/fines")
      .set(session.headers)
      .send({ memberId: borrower.id, amountCents: 500, note: "Dash fine" });

    return { activeBook, activeCopies, borrower };
  }

  it("summarizes the library", async () => {
    const { borrower } = await fixture();

    const res = await (await api()).get("/api/v1/dashboard/summary").set(session.headers);
    expect(res.status).toBe(200);
    expect(res.body.books.titles).toBe(3);
    expect(res.body.books.archived).toBe(1);
    expect(res.body.copies.total).toBe(3);
    expect(res.body.copies.onLoan).toBe(1);
    expect(res.body.copies.reserved).toBe(1);
    expect(res.body.copies.available).toBe(1);
    expect(res.body.members.total).toBe(2);
    expect(res.body.members.active).toBe(1);
    expect(res.body.members.suspended).toBe(1);
    expect(res.body.members.newThisMonth).toBe(2);
    expect(res.body.loans.active).toBe(1);
    expect(res.body.loans.overdue).toBe(0);
    expect(res.body.loans.checkedOutToday).toBe(1);
    expect(res.body.holds.ready).toBe(1);
    expect(res.body.holds.pending).toBe(0);
    expect(res.body.fines.outstandingCents).toBe(500);
    expect(res.body.fines.outstandingCount).toBe(1);

    const memberDetail = await (await api())
      .get(`/api/v1/members/${borrower.id}`)
      .set(session.headers);
    expect(memberDetail.body.activeLoans).toBe(1);
  });

  it("returns a circulation time series", async () => {
    await fixture();

    const res = await (await api())
      .get("/api/v1/dashboard/circulation?days=7")
      .set(session.headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    const today = res.body[res.body.length - 1];
    expect(today.checkouts).toBe(1);
    expect(today.returns).toBe(0);
    expect(today.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const short = await (await api())
      .get("/api/v1/dashboard/circulation?days=1")
      .set(session.headers);
    expect(short.body).toHaveLength(7);
  });

  it("ranks top titles and recent checkouts", async () => {
    const { activeBook, activeCopies, borrower } = await fixture();

    const secondCheckout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: borrower.id, copyId: activeCopies[1].id });
    expect(secondCheckout.status).toBe(201);

    const top = await (await api())
      .get("/api/v1/dashboard/top-titles?days=30&limit=5")
      .set(session.headers);
    expect(top.status).toBe(200);
    expect(top.body[0].bookId).toBe(activeBook.id);
    expect(top.body[0].loanCount).toBe(2);

    const recent = await (await api())
      .get("/api/v1/dashboard/recent-checkouts?limit=1")
      .set(session.headers);
    expect(recent.status).toBe(200);
    expect(recent.body).toHaveLength(1);
    expect(recent.body[0].memberName).toBe("Dash Borrower");
    expect(recent.body[0].bookTitle).toBe("Active Book");
    expect(recent.body[0].copyBarcode).toBe(activeCopies[1].barcode);
  });

  it("returns zeroed metrics for a fresh tenant", async () => {
    await fixture();

    const other = await registerTenant();
    const res = await (await api()).get("/api/v1/dashboard/summary").set(other.headers);
    expect(res.status).toBe(200);
    expect(res.body.books.titles).toBe(0);
    expect(res.body.copies.total).toBe(0);
    expect(res.body.members.total).toBe(0);
    expect(res.body.loans.active).toBe(0);
    expect(res.body.fines.outstandingCents).toBe(0);

    const series = await (await api())
      .get("/api/v1/dashboard/circulation?days=7")
      .set(other.headers);
    expect(series.body.every((row: { checkouts: number }) => row.checkouts === 0)).toBe(true);

    const top = await (await api()).get("/api/v1/dashboard/top-titles").set(other.headers);
    expect(top.body).toEqual([]);

    const recent = await (await api()).get("/api/v1/dashboard/recent-checkouts").set(other.headers);
    expect(recent.body).toEqual([]);
  });
});
