import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  mainBranch,
  registerTenant,
  resetDb,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("members", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    session = await registerTenant();
    branchId = (await mainBranch(session.token)).id;
  });

  it("creates a member with defaults and reads it back", async () => {
    const res = await (await api())
      .post("/api/v1/members")
      .set(session.headers)
      .send({
        fullName: "Ada Reader",
        email: "ada@example.com",
        phone: "+15550100",
        category: "student",
      });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.cardNumber).toMatch(/^M\d{6}$/);
    expect(res.body.status).toBe("active");
    expect(res.body.category).toBe("student");

    const get = await (await api()).get(`/api/v1/members/${res.body.id}`).set(session.headers);
    expect(get.status).toBe(200);
    expect(get.body.activeLoans).toBe(0);
    expect(get.body.overdueLoans).toBe(0);
    expect(get.body.openHolds).toBe(0);
    expect(get.body.outstandingFineCents).toBe(0);

    const byCard = await (await api())
      .get(`/api/v1/members/card/${res.body.cardNumber}`)
      .set(session.headers);
    expect(byCard.status).toBe(200);
    expect(byCard.body.id).toBe(res.body.id);
  });

  it("generates unique card numbers", async () => {
    const cards: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const member = await createMember(session.token, { fullName: `Card Holder ${index}` });
      cards.push(member.cardNumber);
    }
    expect(new Set(cards).size).toBe(5);
    for (const card of cards) expect(card).toMatch(/^M\d{6}$/);
  });

  it("handles explicit and duplicate card numbers", async () => {
    const explicit = await createMember(session.token, {
      fullName: "Explicit Card",
      cardNumber: "LIB-0001",
    });
    expect(explicit.cardNumber).toBe("LIB-0001");

    const duplicate = await (await api())
      .post("/api/v1/members")
      .set(session.headers)
      .send({ fullName: "Duplicate Card", cardNumber: "LIB-0001" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("card_taken");
  });

  it("validates member input", async () => {
    const short = await (await api())
      .post("/api/v1/members")
      .set(session.headers)
      .send({ fullName: "A" });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe("validation_failed");

    const badCategory = await (await api())
      .post("/api/v1/members")
      .set(session.headers)
      .send({ fullName: "Alien Member", category: "alien" });
    expect(badCategory.status).toBe(400);

    const badDate = await (await api())
      .post("/api/v1/members")
      .set(session.headers)
      .send({ fullName: "Bad Date", expiresAt: "2024/01/01" });
    expect(badDate.status).toBe(400);
  });

  it("lists, searches and filters members", async () => {
    await createMember(session.token, { fullName: "Alice Johnson" });
    const bob = await createMember(session.token, {
      fullName: "Bob Stone",
      category: "child",
      cardNumber: "CARD-BOB",
    });
    await createMember(session.token, { fullName: "Carol Danvers", category: "senior" });

    const all = await (await api()).get("/api/v1/members").set(session.headers);
    expect(all.body.meta.total).toBe(3);
    expect(all.body.items[0].fullName).toBe("Alice Johnson");

    const byName = await (await api()).get("/api/v1/members?q=bob").set(session.headers);
    expect(byName.body.items).toHaveLength(1);

    const byCard = await (await api())
      .get("/api/v1/members?q=CARD-BOB")
      .set(session.headers);
    expect(byCard.body.items[0].id).toBe(bob.id);

    const byCategory = await (await api())
      .get("/api/v1/members?category=senior")
      .set(session.headers);
    expect(byCategory.body.meta.total).toBe(1);

    await (await api())
      .patch(`/api/v1/members/${bob.id}`)
      .set(session.headers)
      .send({ status: "suspended" });
    const suspended = await (await api())
      .get("/api/v1/members?status=suspended")
      .set(session.headers);
    expect(suspended.body.items).toHaveLength(1);
    const activeOnly = await (await api())
      .get("/api/v1/members?status=active")
      .set(session.headers);
    expect(activeOnly.body.meta.total).toBe(2);

    const paged = await (await api()).get("/api/v1/members?perPage=2").set(session.headers);
    expect(paged.body.items).toHaveLength(2);
    expect(paged.body.meta.total).toBe(3);
  });

  it("updates members", async () => {
    const member = await createMember(session.token, { fullName: "Old Name" });

    const patched = await (await api())
      .patch(`/api/v1/members/${member.id}`)
      .set(session.headers)
      .send({
        fullName: "New Name",
        category: "teacher",
        email: "new@example.com",
        notes: "Updated",
      });
    expect(patched.status).toBe(200);
    expect(patched.body.fullName).toBe("New Name");
    expect(patched.body.category).toBe("teacher");

    const missing = await (await api())
      .patch("/api/v1/members/00000000-0000-4000-8000-000000000000")
      .set(session.headers)
      .send({ fullName: "Ghost" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("member_not_found");
  });

  it("aggregates loans and blocks closing members with open loans", async () => {
    const book = await createBook(session.token, { title: "Member Aggregate" });
    const [copy] = await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Loan Holder" });

    const checkout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: copy.id });
    expect(checkout.status, JSON.stringify(checkout.body)).toBe(201);

    const withLoan = await (await api()).get(`/api/v1/members/${member.id}`).set(session.headers);
    expect(withLoan.body.activeLoans).toBe(1);

    const listed = await (await api())
      .get("/api/v1/members?q=Loan%20Holder")
      .set(session.headers);
    expect(listed.body.items[0].activeLoans).toBe(1);
    expect(listed.body.items[0].overdueLoans).toBe(0);
    expect(listed.body.items[0].openHolds).toBe(0);

    const stats = await (await api()).get("/api/v1/members/stats").set(session.headers);
    expect(stats.status).toBe(200);
    expect(stats.body.total).toBe(1);
    expect(stats.body.active).toBe(1);

    const blocked = await (await api())
      .delete(`/api/v1/members/${member.id}`)
      .set(session.headers);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("open_loans");

    const checkin = await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: copy.id });
    expect(checkin.status, JSON.stringify(checkin.body)).toBe(200);

    const closed = await (await api())
      .delete(`/api/v1/members/${member.id}`)
      .set(session.headers);
    expect(closed.status).toBe(204);

    const after = await (await api()).get(`/api/v1/members/${member.id}`).set(session.headers);
    expect(after.body.status).toBe("closed");
  });

  it("isolates members across tenants", async () => {
    const member = await createMember(session.token, { fullName: "Tenant Private" });
    const other = await registerTenant();

    const get = await (await api()).get(`/api/v1/members/${member.id}`).set(other.headers);
    expect(get.status).toBe(404);

    const list = await (await api()).get("/api/v1/members").set(other.headers);
    expect(list.body.meta.total).toBe(0);

    const byCard = await (await api())
      .get(`/api/v1/members/card/${member.cardNumber}`)
      .set(other.headers);
    expect(byCard.body?.id).toBeUndefined();
  });
});
