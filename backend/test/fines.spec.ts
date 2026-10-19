import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  login,
  mainBranch,
  registerTenant,
  resetDb,
  setupLibrary,
  withAdmin,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("fines", () => {
  let session: TenantSession;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
  });

  async function createFine(body: Record<string, unknown>) {
    return (await api()).post("/api/v1/fines").set(session.headers).send(body);
  }

  it("creates manual fines by member id and card number", async () => {
    const member = await createMember(session.token, { fullName: "Fined Person" });

    const res = await createFine({
      memberId: member.id,
      type: "manual",
      amountCents: 500,
      note: "Damaged jacket",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.status).toBe("outstanding");
    expect(res.body.amountCents).toBe(500);
    expect(res.body.currency).toBe("USD");
    expect(res.body.note).toBe("Damaged jacket");

    const byCard = await createFine({
      cardNumber: member.cardNumber,
      type: "damaged",
      amountCents: 250,
    });
    expect(byCard.status).toBe(201);
    expect(byCard.body.memberId).toBe(member.id);

    const zero = await createFine({ memberId: member.id, amountCents: 0 });
    expect(zero.status).toBe(400);

    const ghost = await createFine({
      memberId: "00000000-0000-4000-8000-000000000000",
      amountCents: 100,
    });
    expect(ghost.status).toBe(404);
    expect(ghost.body.error.code).toBe("member_not_found");
  });

  it("lists, filters and fetches fines", async () => {
    const alice = await createMember(session.token, { fullName: "Alice Fines" });
    const bob = await createMember(session.token, { fullName: "Bob Fines" });
    const fineOne = await createFine({ memberId: alice.id, amountCents: 300, type: "manual" });
    await createFine({ memberId: bob.id, amountCents: 700, type: "damaged" });

    const all = await (await api()).get("/api/v1/fines").set(session.headers);
    expect(all.body.meta.total).toBe(2);

    const byStatus = await (await api())
      .get("/api/v1/fines?status=outstanding")
      .set(session.headers);
    expect(byStatus.body.meta.total).toBe(2);

    const byType = await (await api()).get("/api/v1/fines?type=damaged").set(session.headers);
    expect(byType.body.meta.total).toBe(1);
    expect(byType.body.items[0].memberName).toBe("Bob Fines");

    const byMember = await (await api())
      .get(`/api/v1/fines?memberId=${alice.id}`)
      .set(session.headers);
    expect(byMember.body.meta.total).toBe(1);

    const byQuery = await (await api())
      .get("/api/v1/fines?q=Alice")
      .set(session.headers);
    expect(byQuery.body.items[0].id).toBe(fineOne.body.id);

    const detail = await (await api())
      .get(`/api/v1/fines/${fineOne.body.id}`)
      .set(session.headers);
    expect(detail.status).toBe(200);
    expect(detail.body.memberCard).toBe(alice.cardNumber);
  });

  it("pays fines and updates member balances", async () => {
    const member = await createMember(session.token, { fullName: "Paying Person" });
    const fine = await createFine({ memberId: member.id, amountCents: 400 });

    const before = await (await api())
      .get(`/api/v1/members/${member.id}`)
      .set(session.headers);
    expect(before.body.outstandingFineCents).toBe(400);

    const paid = await (await api())
      .post(`/api/v1/fines/${fine.body.id}/pay`)
      .set(session.headers)
      .send({ note: "Paid at desk" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(paid.body.status).toBe("paid");
    expect(paid.body.paidAt).toBeTruthy();

    const again = await (await api())
      .post(`/api/v1/fines/${fine.body.id}/pay`)
      .set(session.headers)
      .send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("fine_not_open");

    const after = await (await api())
      .get(`/api/v1/members/${member.id}`)
      .set(session.headers);
    expect(after.body.outstandingFineCents).toBe(0);
  });

  it("waives fines and enforces role rules", async () => {
    const member = await createMember(session.token, { fullName: "Waived Person" });
    const fine = await createFine({ memberId: member.id, amountCents: 900 });

    const created = await (await api())
      .post("/api/v1/users")
      .set(session.headers)
      .send({
        email: "assistant@test.dev",
        name: "Assistant One",
        password: "Password123!",
        role: "assistant",
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const assistantLogin = await login(session.slug, "assistant@test.dev", "Password123!");
    expect(assistantLogin.status).toBe(200);
    const assistantToken = assistantLogin.body.accessToken as string;

    const assistantWaive = await (await api())
      .post(`/api/v1/fines/${fine.body.id}/waive`)
      .set("Authorization", `Bearer ${assistantToken}`)
      .send({});
    expect(assistantWaive.status).toBe(403);

    const assistantPay = await (await api())
      .post(`/api/v1/fines/${fine.body.id}/pay`)
      .set("Authorization", `Bearer ${assistantToken}`)
      .send({});
    expect(assistantPay.status).toBe(200);

    const secondFine = await createFine({ memberId: member.id, amountCents: 150 });
    const waived = await (await api())
      .post(`/api/v1/fines/${secondFine.body.id}/waive`)
      .set(session.headers)
      .send({ note: "Goodwill" });
    expect(waived.status, JSON.stringify(waived.body)).toBe(200);
    expect(waived.body.status).toBe("waived");
    expect(waived.body.note).toContain("Goodwill");

    const rewaive = await (await api())
      .post(`/api/v1/fines/${secondFine.body.id}/waive`)
      .set(session.headers)
      .send({});
    expect(rewaive.status).toBe(409);
  });

  it("summarizes outstanding, collected and waived amounts", async () => {
    const member = await createMember(session.token, { fullName: "Summary Person" });
    await createFine({ memberId: member.id, amountCents: 300 });
    const paid = await createFine({ memberId: member.id, amountCents: 200 });
    const waived = await createFine({ memberId: member.id, amountCents: 100 });

    await (await api()).post(`/api/v1/fines/${paid.body.id}/pay`).set(session.headers).send({});
    await (await api()).post(`/api/v1/fines/${waived.body.id}/waive`).set(session.headers).send({});

    const summary = await (await api()).get("/api/v1/fines/summary").set(session.headers);
    expect(summary.status).toBe(200);
    expect(summary.body.outstandingCents).toBe(300);
    expect(summary.body.outstandingCount).toBe(1);
    expect(summary.body.collectedCents).toBe(200);
    expect(summary.body.waivedCents).toBe(100);
    expect(summary.body.collectedLast30).toBe(200);
  });

  it("surfaces overdue fines generated by checkin", async () => {
    const book = await createBook(session.token, { title: "Overdue Fine Book" });
    const branch = await mainBranch(session.token);
    const copies = await addCopies(session.token, book.id, branch.id, 1);
    const member = await createMember(session.token, { fullName: "Overdue Person" });

    const checkout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: copies[0].id });
    await withAdmin(async (sql) => {
      await sql`update loans set due_at = now() - interval '4 days 1 hour', status = 'overdue'
        where id = ${checkout.body.id}`;
    });
    await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: copies[0].id });

    const list = await (await api())
      .get(`/api/v1/fines?memberId=${member.id}&type=overdue`)
      .set(session.headers);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.items[0].amountCents).toBe(75);
    expect(list.body.items[0].note).toContain("4 day(s) overdue");
  });

  it("isolates fines across tenants", async () => {
    const member = await createMember(session.token, { fullName: "Private Fine" });
    const fine = await createFine({ memberId: member.id, amountCents: 111 });

    const other = await registerTenant();
    const peek = await (await api()).get(`/api/v1/fines/${fine.body.id}`).set(other.headers);
    expect(peek.status).toBe(404);

    const list = await (await api()).get("/api/v1/fines").set(other.headers);
    expect(list.body.meta.total).toBe(0);

    const pay = await (await api())
      .post(`/api/v1/fines/${fine.body.id}/pay`)
      .set(other.headers)
      .send({});
    expect(pay.status).toBe(404);
  });
});
