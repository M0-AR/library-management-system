import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  mainBranch,
  registerTenant,
  resetDb,
  setupLibrary,
  withAdmin,
} from "./helpers";
import type { TenantSession } from "./helpers";

interface LoanDetail {
  id: string;
  status: string;
  dueAt: string;
  renewedCount: number;
  memberId: string;
  bookId: string;
  copyId: string;
}

describe("circulation", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  async function fixture(copies = 1) {
    const book = await createBook(session.token, { title: "Circulation Test" });
    const copyRows = await addCopies(session.token, book.id, branchId, copies);
    const member = await createMember(session.token, { fullName: "Borrower One" });
    return { book, copies: copyRows, member };
  }

  async function checkout(body: Record<string, unknown>): Promise<LoanDetail> {
    const res = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as LoanDetail;
  }

  it("creates a loan with a computed due date", async () => {
    const { copies, member } = await fixture();

    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });
    expect(loan.status).toBe("active");
    expect(loan.memberId).toBe(member.id);
    expect(loan.copyId).toBe(copies[0].id);
    expect(loan.renewedCount).toBe(0);

    const dueInDays = (new Date(loan.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(dueInDays).toBeGreaterThan(13.9);
    expect(dueInDays).toBeLessThan(14.1);

    const copyList = await (await api())
      .get(`/api/v1/books/${loan.bookId}/copies`)
      .set(session.headers);
    expect(copyList.body.find((row: { id: string }) => row.id === copies[0].id).status).toBe(
      "on_loan",
    );

    const detail = await (await api()).get(`/api/v1/loans/${loan.id}`).set(session.headers);
    expect(detail.status).toBe(200);
    expect(detail.body.memberCard).toBe(member.cardNumber);
  });

  it("accepts barcode and card number lookups", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ cardNumber: member.cardNumber, barcode: copies[0].barcode });
    expect(loan.memberId).toBe(member.id);
  });

  it("rejects copies that are already checked out", async () => {
    const { copies, member } = await fixture();
    await checkout({ memberId: member.id, copyId: copies[0].id });

    const other = await createMember(session.token, { fullName: "Borrower Two" });
    const res = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: other.id, copyId: copies[0].id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("copy_unavailable");
  });

  it("enforces member status, expiry, fines and loan limits", async () => {
    const { book, copies, member } = await fixture(2);

    await (await api())
      .patch(`/api/v1/members/${member.id}`)
      .set(session.headers)
      .send({ status: "suspended" });
    const suspended = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: copies[0].id });
    expect(suspended.status).toBe(409);
    expect(suspended.body.error.code).toBe("member_suspended");
    await (await api())
      .patch(`/api/v1/members/${member.id}`)
      .set(session.headers)
      .send({ status: "active" });

    const expiredMember = await createMember(session.token, {
      fullName: "Expired Member",
      expiresAt: "2020-01-01",
    });
    const expired = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: expiredMember.id, copyId: copies[0].id });
    expect(expired.status).toBe(409);
    expect(expired.body.error.code).toBe("membership_expired");

    const fined = await createMember(session.token, { fullName: "Fined Member" });
    await withAdmin(async (sql) => {
      await sql`
        insert into fines (tenant_id, member_id, type, amount_cents, status, created_by)
        values (${session.tenantId}, ${fined.id}, 'overdue', 6000, 'outstanding', ${session.userId})`;
    });
    const finesBlocked = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: fined.id, copyId: copies[0].id });
    expect(finesBlocked.status).toBe(409);
    expect(finesBlocked.body.error.code).toBe("fines_exceeded");

    await (await api())
      .patch("/api/v1/tenants/me/settings")
      .set(session.headers)
      .send({ circulation: { maxLoansPerMember: 1 } });
    await checkout({ memberId: member.id, copyId: copies[0].id });
    const atLimit = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: copies[1].id });
    expect(atLimit.status).toBe(409);
    expect(atLimit.body.error.code).toBe("loan_limit_reached");

    const bookCheck = await (await api()).get(`/api/v1/books/${book.id}`).set(session.headers);
    expect(bookCheck.status).toBe(200);
  });

  it("checks copies back in and frees them", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });

    const checkin = await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: copies[0].id });
    expect(checkin.status, JSON.stringify(checkin.body)).toBe(200);
    expect(checkin.body.overdueDays).toBe(0);
    expect(checkin.body.fineCents).toBe(0);
    expect(checkin.body.copyStatus).toBe("available");

    const detail = await (await api()).get(`/api/v1/loans/${loan.id}`).set(session.headers);
    expect(detail.body.status).toBe("returned");
    expect(detail.body.returnedAt).not.toBeNull();

    const again = await checkout({ memberId: member.id, copyId: copies[0].id });
    expect(again.id).not.toBe(loan.id);
  });

  it("charges overdue fines on checkin", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });

    await withAdmin(async (sql) => {
      await sql`
        update loans set due_at = now() - interval '5 days 1 hour', status = 'overdue'
        where id = ${loan.id}`;
    });

    const checkin = await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: copies[0].id });
    expect(checkin.status, JSON.stringify(checkin.body)).toBe(200);
    expect(checkin.body.overdueDays).toBe(5);
    expect(checkin.body.fineCents).toBe(100);
    expect(checkin.body.fineId).toBeTruthy();

    const memberRow = await (await api())
      .get(`/api/v1/members/${member.id}`)
      .set(session.headers);
    expect(memberRow.body.outstandingFineCents).toBe(100);
  });

  it("renews loans until the limit", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });

    const first = await (await api())
      .post(`/api/v1/loans/${loan.id}/renew`)
      .set(session.headers);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.renewedCount).toBe(1);
    const extended = new Date(first.body.dueAt).getTime() - new Date(loan.dueAt).getTime();
    expect(Math.round(extended / (24 * 60 * 60 * 1000))).toBe(14);

    const second = await (await api())
      .post(`/api/v1/loans/${loan.id}/renew`)
      .set(session.headers);
    expect(second.status).toBe(200);
    expect(second.body.renewedCount).toBe(2);

    const third = await (await api())
      .post(`/api/v1/loans/${loan.id}/renew`)
      .set(session.headers);
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("renewal_limit_reached");
  });

  it("blocks renewal of overdue loans", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });
    await withAdmin(async (sql) => {
      await sql`update loans set due_at = now() - interval '2 days', status = 'overdue' where id = ${loan.id}`;
    });
    const res = await (await api())
      .post(`/api/v1/loans/${loan.id}/renew`)
      .set(session.headers);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("loan_overdue");
  });

  it("uses holds to block renewal and fulfil on checkin", async () => {
    const { book, copies, member } = await fixture();
    const waiter = await createMember(session.token, { fullName: "Hold Waiter" });
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });

    const holdRes = await (await api())
      .post("/api/v1/holds")
      .set(session.headers)
      .send({ bookId: book.id, memberId: waiter.id });
    expect(holdRes.status, JSON.stringify(holdRes.body)).toBe(201);

    const blocked = await (await api())
      .post(`/api/v1/loans/${loan.id}/renew`)
      .set(session.headers);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("holds_waiting");

    const checkin = await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: copies[0].id });
    expect(checkin.status).toBe(200);
    expect(checkin.body.copyStatus).toBe("reserved");
    expect(checkin.body.nextHold.memberId).toBe(waiter.id);

    const hold = await (await api())
      .get(`/api/v1/holds/${holdRes.body.id}`)
      .set(session.headers);
    expect(hold.body.status).toBe("ready");
    expect(hold.body.expiresAt).toBeTruthy();

    const fulfilled = await checkout({ memberId: waiter.id, copyId: copies[0].id });
    expect(fulfilled.memberId).toBe(waiter.id);
    const after = await (await api())
      .get(`/api/v1/holds/${holdRes.body.id}`)
      .set(session.headers);
    expect(after.body.status).toBe("fulfilled");
  });

  it("marks loans lost with a fee", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });

    const lost = await (await api())
      .post(`/api/v1/loans/${loan.id}/lost`)
      .set(session.headers);
    expect(lost.status, JSON.stringify(lost.body)).toBe(200);
    expect(lost.body.fineCents).toBe(3000);

    const copyRow = await (await api())
      .get(`/api/v1/books/${loan.bookId}/copies`)
      .set(session.headers);
    expect(copyRow.body.find((row: { id: string }) => row.id === copies[0].id).status).toBe("lost");

    const memberRow = await (await api())
      .get(`/api/v1/members/${member.id}`)
      .set(session.headers);
    expect(memberRow.body.outstandingFineCents).toBe(3000);

    const repeat = await (await api())
      .post(`/api/v1/loans/${loan.id}/lost`)
      .set(session.headers);
    expect(repeat.status).toBe(409);
    expect(repeat.body.error.code).toBe("already_returned");
  });

  it("lists loans and summarizes overdue items", async () => {
    const { book, copies, member } = await fixture(2);
    const active = await checkout({ memberId: member.id, copyId: copies[0].id });
    const overdue = await checkout({ memberId: member.id, copyId: copies[1].id });
    await withAdmin(async (sql) => {
      await sql`update loans set due_at = now() - interval '3 days', status = 'overdue' where id = ${overdue.id}`;
    });

    const all = await (await api()).get("/api/v1/loans").set(session.headers);
    expect(all.body.meta.total).toBe(2);

    const activeOnly = await (await api()).get("/api/v1/loans?status=active").set(session.headers);
    expect(activeOnly.body.items).toHaveLength(1);
    expect(activeOnly.body.items[0].id).toBe(active.id);

    const byMember = await (await api())
      .get(`/api/v1/loans?memberId=${member.id}`)
      .set(session.headers);
    expect(byMember.body.meta.total).toBe(2);

    const byTitle = await (await api())
      .get(`/api/v1/loans?q=${encodeURIComponent(book.title)}`)
      .set(session.headers);
    expect(byTitle.body.meta.total).toBe(2);

    const overdueOnly = await (await api())
      .get("/api/v1/loans?overdue=true")
      .set(session.headers);
    expect(overdueOnly.body.items).toHaveLength(1);
    expect(overdueOnly.body.items[0].id).toBe(overdue.id);

    const summary = await (await api()).get("/api/v1/loans/overdue").set(session.headers);
    expect(summary.status).toBe(200);
    expect(summary.body).toHaveLength(1);
    expect(summary.body[0].overdueDays).toBe(3);
  });

  it("isolates circulation across tenants", async () => {
    const { copies, member } = await fixture();
    const loan = await checkout({ memberId: member.id, copyId: copies[0].id });

    const other = await registerTenant();
    const steal = await (await api())
      .post("/api/v1/loans/checkout")
      .set(other.headers)
      .send({ memberId: member.id, copyId: copies[0].id });
    expect(steal.status).toBe(404);

    const peek = await (await api()).get(`/api/v1/loans/${loan.id}`).set(other.headers);
    expect(peek.status).toBe(404);

    const list = await (await api()).get("/api/v1/loans").set(other.headers);
    expect(list.body.meta.total).toBe(0);
  });
});
