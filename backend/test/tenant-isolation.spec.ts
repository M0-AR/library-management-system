import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  login,
  mainBranch,
  resetDb,
  setupLibrary,
} from "./helpers";
import type { TenantSession } from "./helpers";

function items(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  const record = body as { items?: unknown; rows?: unknown; data?: unknown } | null;
  if (!record) return [];
  for (const key of ["items", "rows", "data"] as const) {
    const value = record[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }
  return [];
}

describe("tenant isolation", () => {
  let alpha: TenantSession;
  let beta: TenantSession;

  beforeEach(async () => {
    await resetDb();
    alpha = (await setupLibrary()).session;
    beta = (await setupLibrary()).session;
  });

  async function prepareAlpha() {
    const branch = await mainBranch(alpha.token);
    const book = await createBook(alpha.token, { title: "Alpha Secret Ledger" });
    const copies = await addCopies(alpha.token, book.id, branch.id, 1);
    const member = await createMember(alpha.token, { fullName: "Alpha Exclusive Member" });
    const client = await api();

    const checkout = await client
      .post("/api/v1/loans/checkout")
      .set(alpha.headers)
      .send({ memberId: member.id, copyId: copies[0].id });
    expect(checkout.status, JSON.stringify(checkout.body)).toBe(201);

    const fine = await client
      .post("/api/v1/fines")
      .set(alpha.headers)
      .send({ memberId: member.id, amountCents: 250, type: "manual", notes: "Alpha fine" });
    expect(fine.status, JSON.stringify(fine.body)).toBe(201);

    const holdBook = await createBook(alpha.token, { title: "Alpha Reserved Title" });
    await addCopies(alpha.token, holdBook.id, branch.id, 1);
    const hold = await client
      .post("/api/v1/holds")
      .set(alpha.headers)
      .send({ bookId: holdBook.id, memberId: member.id });
    expect(hold.status, JSON.stringify(hold.body)).toBe(201);

    return {
      book,
      copy: copies[0],
      member,
      branchId: branch.id,
      loanId: checkout.body.id as string,
      fineId: fine.body.id as string,
      holdId: hold.body.id as string,
    };
  }

  it("returns 404 for cross-tenant reads", async () => {
    const f = await prepareAlpha();
    const client = await api();

    const reads: Array<[string, () => Promise<{ status: number }>]> = [
      ["book", () => client.get(`/api/v1/books/${f.book.id}`).set(beta.headers)],
      ["book copies", () => client.get(`/api/v1/books/${f.book.id}/copies`).set(beta.headers)],
      ["member by id", () => client.get(`/api/v1/members/${f.member.id}`).set(beta.headers)],
      [
        "member by card",
        () => client.get(`/api/v1/members/card/${f.member.cardNumber}`).set(beta.headers),
      ],
      ["loan", () => client.get(`/api/v1/loans/${f.loanId}`).set(beta.headers)],
      ["fine", () => client.get(`/api/v1/fines/${f.fineId}`).set(beta.headers)],
      ["hold", () => client.get(`/api/v1/holds/${f.holdId}`).set(beta.headers)],
    ];

    for (const [label, send] of reads) {
      const res = await send();
      expect(res.status, `cross-tenant read of ${label}`).toBe(404);
    }
  });

  it("rejects cross-tenant writes and circulation actions", async () => {
    const f = await prepareAlpha();
    const client = await api();

    const writes: Array<[string, () => Promise<{ status: number }>]> = [
      [
        "update book",
        () => client.patch(`/api/v1/books/${f.book.id}`).set(beta.headers).send({ title: "Hijacked" }),
      ],
      [
        "status change",
        () =>
          client
            .post(`/api/v1/books/${f.book.id}/status`)
            .set(beta.headers)
            .send({ status: "archived" }),
      ],
      ["delete book", () => client.delete(`/api/v1/books/${f.book.id}`).set(beta.headers)],
      [
        "add copies",
        () =>
          client
            .post(`/api/v1/books/${f.book.id}/copies`)
            .set(beta.headers)
            .send({ branchId: f.branchId, count: 1 }),
      ],
      ["update copy", () => client.patch(`/api/v1/copies/${f.copy.id}`).set(beta.headers).send({})],
      ["withdraw copy", () => client.delete(`/api/v1/copies/${f.copy.id}`).set(beta.headers)],
      [
        "update member",
        () =>
          client
            .patch(`/api/v1/members/${f.member.id}`)
            .set(beta.headers)
            .send({ fullName: "Hijacked" }),
      ],
      ["delete member", () => client.delete(`/api/v1/members/${f.member.id}`).set(beta.headers)],
      [
        "checkout",
        () =>
          client
            .post("/api/v1/loans/checkout")
            .set(beta.headers)
            .send({ memberId: f.member.id, copyId: f.copy.id }),
      ],
      [
        "checkin",
        () => client.post("/api/v1/loans/checkin").set(beta.headers).send({ copyId: f.copy.id }),
      ],
      ["renew", () => client.post(`/api/v1/loans/${f.loanId}/renew`).set(beta.headers)],
      [
        "place hold",
        () =>
          client
            .post("/api/v1/holds")
            .set(beta.headers)
            .send({ bookId: f.book.id, memberId: f.member.id }),
      ],
      ["cancel hold", () => client.post(`/api/v1/holds/${f.holdId}/cancel`).set(beta.headers)],
      ["pay fine", () => client.post(`/api/v1/fines/${f.fineId}/pay`).set(beta.headers).send({})],
      ["waive fine", () => client.post(`/api/v1/fines/${f.fineId}/waive`).set(beta.headers).send({})],
    ];

    for (const [label, send] of writes) {
      const res = await send();
      expect(res.status, `cross-tenant ${label}`).toBe(404);
    }

    const book = await client.get(`/api/v1/books/${f.book.id}`).set(alpha.headers);
    expect(book.status).toBe(200);
    expect(book.body.title).toBe("Alpha Secret Ledger");

    const copies = await client.get(`/api/v1/books/${f.book.id}/copies`).set(alpha.headers);
    const copyRow = (copies.body as Array<{ id: string; status: string }>).find(
      (row) => row.id === f.copy.id,
    );
    expect(copyRow?.status).toBe("on_loan");

    const member = await client.get(`/api/v1/members/${f.member.id}`).set(alpha.headers);
    expect(member.body.fullName).toBe("Alpha Exclusive Member");

    const loan = await client.get(`/api/v1/loans/${f.loanId}`).set(alpha.headers);
    expect(loan.status).toBe(200);
    expect(loan.body.status).toBe("active");

    const fine = await client.get(`/api/v1/fines/${f.fineId}`).set(alpha.headers);
    expect(fine.body.status).toBe("outstanding");

    const hold = await client.get(`/api/v1/holds/${f.holdId}`).set(alpha.headers);
    expect(["pending", "ready"]).toContain(hold.body.status);
  });

  it("never leaks foreign rows through lists, search, exports or audit", async () => {
    const f = await prepareAlpha();
    const client = await api();

    const books = await client
      .get(`/api/v1/books?q=${encodeURIComponent("Alpha Secret")}`)
      .set(beta.headers);
    expect(books.status).toBe(200);
    expect(items(books.body)).toHaveLength(0);

    const members = await client
      .get(`/api/v1/members?q=${encodeURIComponent("Alpha Exclusive")}`)
      .set(beta.headers);
    expect(members.status).toBe(200);
    expect(items(members.body)).toHaveLength(0);

    for (const path of ["/api/v1/loans", "/api/v1/holds", "/api/v1/fines"]) {
      const res = await client.get(path).set(beta.headers);
      expect(res.status, path).toBe(200);
      expect(items(res.body), path).toHaveLength(0);
    }

    const audit = await client.get("/api/v1/audit-logs?limit=100").set(beta.headers);
    expect(audit.status).toBe(200);
    const auditText = JSON.stringify(audit.body);
    expect(auditText).not.toContain(f.member.id);
    expect(auditText).not.toContain(f.book.id);
    expect(auditText).not.toContain("Alpha Exclusive Member");

    const membersCsv = await client.get("/api/v1/exports/members").set(beta.headers);
    expect(membersCsv.status).toBe(200);
    expect(membersCsv.text).not.toContain("Alpha Exclusive Member");
    expect(membersCsv.text).not.toContain(f.member.cardNumber);

    const loansCsv = await client.get("/api/v1/exports/loans").set(beta.headers);
    expect(loansCsv.status).toBe(200);
    expect(loansCsv.text).not.toContain("Alpha Exclusive Member");

    const alphaMembers = await client.get("/api/v1/members").set(alpha.headers);
    expect(
      items(alphaMembers.body).some((row) => row.fullName === "Alpha Exclusive Member"),
    ).toBe(true);
  });

  it("scopes the patron portal to its own tenant", async () => {
    await prepareAlpha();
    const betaBranch = await mainBranch(beta.token);
    const betaBook = await createBook(beta.token, { title: "Beta Residents Only" });
    await addCopies(beta.token, betaBook.id, betaBranch.id, 1);

    const member = await createMember(alpha.token, { fullName: "Alpha Portal Patron" });
    const email = "alpha.portal@matrix.test";
    const user = await (await api())
      .post("/api/v1/users")
      .set(alpha.headers)
      .send({
        email,
        name: "Alpha Portal Patron",
        password: "Password123!",
        role: "patron",
        memberId: member.id,
      });
    expect(user.status, JSON.stringify(user.body)).toBe(201);

    const auth = await login(alpha.slug, email, "Password123!");
    expect(auth.status).toBe(200);
    const patronHeaders = { Authorization: `Bearer ${auth.body.accessToken as string}` };

    const client = await api();
    const profile = await client.get("/api/v1/me").set(patronHeaders);
    expect(profile.status).toBe(200);
    expect(profile.body.member.cardNumber).toBe(member.cardNumber);

    const crossHold = await client
      .post("/api/v1/me/holds")
      .set(patronHeaders)
      .send({ bookId: betaBook.id });
    expect(crossHold.status).toBe(404);

    const crossRenew = await client
      .post(`/api/v1/me/loans/${randomUuid()}/renew`)
      .set(patronHeaders);
    expect(crossRenew.status).toBe(404);

    const betaPatronless = await client.get("/api/v1/me").set(beta.headers);
    expect(betaPatronless.status).toBe(403);
  });
});

function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}
