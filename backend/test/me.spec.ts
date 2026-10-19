import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  login,
  resetDb,
  setupLibrary,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("patron portal (me)", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  async function makePatron(name = "Portal Patron") {
    const member = await createMember(session.token, { fullName: name });
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@patron.test`;
    const created = await (await api())
      .post("/api/v1/users")
      .set(session.headers)
      .send({ email, name, password: "Password123!", role: "patron", memberId: member.id });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const loginRes = await login(session.slug, email, "Password123!");
    expect(loginRes.status).toBe(200);
    return {
      member,
      email,
      headers: { Authorization: `Bearer ${loginRes.body.accessToken as string}` },
    };
  }

  async function checkoutFor(memberId: string, title = "Patron Book") {
    const book = await createBook(session.token, { title });
    const copies = await addCopies(session.token, book.id, branchId, 1);
    const res = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId, copyId: copies[0].id });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return { book, copy: copies[0], loan: res.body };
  }

  it("returns the patron profile with live stats and allows self-edits", async () => {
    const patron = await makePatron();
    await checkoutFor(patron.member.id);

    const holdBook = await createBook(session.token, { title: "Held Book" });
    await addCopies(session.token, holdBook.id, branchId, 1);
    const hold = await (await api())
      .post("/api/v1/me/holds")
      .set(patron.headers)
      .send({ bookId: holdBook.id });
    expect(hold.status).toBe(201);

    await (await api())
      .post("/api/v1/fines")
      .set(session.headers)
      .send({ memberId: patron.member.id, amountCents: 250, note: "Patron fine" });

    const profile = await (await api()).get("/api/v1/me").set(patron.headers);
    expect(profile.status).toBe(200);
    expect(profile.body.member.cardNumber).toBe(patron.member.cardNumber);
    expect(profile.body.member.fullName).toBe("Portal Patron");
    expect(profile.body.stats.activeLoans).toBe(1);
    expect(profile.body.stats.openHolds).toBe(1);
    expect(profile.body.stats.outstandingCents).toBe(250);

    const updated = await (await api())
      .patch("/api/v1/me")
      .set(patron.headers)
      .send({ phone: "+1 555 0100", email: "portal.updated@patron.test" });
    expect(updated.status).toBe(200);
    expect(updated.body.member.phone).toBe("+1 555 0100");
    expect(updated.body.member.email).toBe("portal.updated@patron.test");

    const badEmail = await (await api())
      .patch("/api/v1/me")
      .set(patron.headers)
      .send({ email: "not-an-email" });
    expect(badEmail.status).toBe(400);

    const staffDenied = await (await api()).get("/api/v1/me").set(session.headers);
    expect(staffDenied.status).toBe(403);
  });

  it("lists loans, renews within limits, and shows history", async () => {
    const patron = await makePatron();
    const { loan } = await checkoutFor(patron.member.id);

    const loans = await (await api()).get("/api/v1/me/loans").set(patron.headers);
    expect(loans.status).toBe(200);
    expect(loans.body).toHaveLength(1);
    expect(loans.body[0].bookTitle).toBe("Patron Book");

    const first = await (await api())
      .post(`/api/v1/me/loans/${loan.id}/renew`)
      .set(patron.headers);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.renewedCount).toBe(1);

    const second = await (await api())
      .post(`/api/v1/me/loans/${loan.id}/renew`)
      .set(patron.headers);
    expect(second.body.renewedCount).toBe(2);

    const third = await (await api())
      .post(`/api/v1/me/loans/${loan.id}/renew`)
      .set(patron.headers);
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("renewal_limit_reached");

    const other = await makePatron("Other Patron");
    const otherLoan = await checkoutFor(other.member.id, "Other Book");
    const steal = await (await api())
      .post(`/api/v1/me/loans/${otherLoan.loan.id}/renew`)
      .set(patron.headers);
    expect(steal.status).toBe(403);
    expect(steal.body.error.code).toBe("not_your_loan");

    await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: loan.copyId });

    const after = await (await api()).get("/api/v1/me/loans").set(patron.headers);
    expect(after.body).toHaveLength(0);

    const history = await (await api()).get("/api/v1/me/loans/history").set(patron.headers);
    expect(history.status).toBe(200);
    expect(history.body.some((l: { id: string; status: string }) => l.id === loan.id && l.status === "returned")).toBe(true);
  });

  it("places and cancels holds from the portal", async () => {
    const patron = await makePatron();
    const book = await createBook(session.token, { title: "Portal Hold Book" });
    await addCopies(session.token, book.id, branchId, 1);

    const placed = await (await api())
      .post("/api/v1/me/holds")
      .set(patron.headers)
      .send({ bookId: book.id });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body.status).toBe("ready");

    const open = await (await api()).get("/api/v1/me/holds").set(patron.headers);
    expect(open.body).toHaveLength(1);
    expect(open.body[0].bookTitle).toBe("Portal Hold Book");

    const other = await makePatron("Hold Thief");
    const steal = await (await api())
      .post(`/api/v1/me/holds/${placed.body.id}/cancel`)
      .set(other.headers);
    expect(steal.status).toBe(403);
    expect(steal.body.error.code).toBe("not_your_hold");

    const cancelled = await (await api())
      .post(`/api/v1/me/holds/${placed.body.id}/cancel`)
      .set(patron.headers);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");

    const empty = await (await api()).get("/api/v1/me/holds").set(patron.headers);
    expect(empty.body).toHaveLength(0);

    const ghost = await (await api())
      .post("/api/v1/me/holds")
      .set(patron.headers)
      .send({ bookId: "00000000-0000-4000-8000-000000000000" });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error.code).toBe("book_not_found");
  });

  it("shows fines and clears them when paid", async () => {
    const patron = await makePatron();

    const fine = await (await api())
      .post("/api/v1/fines")
      .set(session.headers)
      .send({ memberId: patron.member.id, amountCents: 300, note: "Portal fine" });
    expect(fine.status).toBe(201);

    const mine = await (await api()).get("/api/v1/me/fines").set(patron.headers);
    expect(mine.status).toBe(200);
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.outstandingCents).toBe(300);

    await (await api())
      .post(`/api/v1/fines/${fine.body.id}/pay`)
      .set(session.headers)
      .send({});

    const after = await (await api()).get("/api/v1/me/fines").set(patron.headers);
    expect(after.body.items[0].status).toBe("paid");
    expect(after.body.outstandingCents).toBe(0);
  });

  it("keeps patron data isolated per account", async () => {
    const alice = await makePatron("Alice Patron");
    await makePatron("Bob Patron");
    await checkoutFor(alice.member.id);

    const aliceLoans = await (await api()).get("/api/v1/me/loans").set(alice.headers);
    expect(aliceLoans.body).toHaveLength(1);

    const bob = await makePatron("Bob Second");
    const bobLoans = await (await api()).get("/api/v1/me/loans").set(bob.headers);
    expect(bobLoans.body).toHaveLength(0);
    expect(bobLoans.body).not.toEqual(aliceLoans.body);
  });
});
