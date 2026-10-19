import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  resetDb,
  setupLibrary,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("exports", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  it("exports loans, members and fines as CSV", async () => {
    const book = await createBook(session.token, {
      title: "Export Test",
      authors: ["Autor, Anna"],
    });
    const copies = await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, {
      fullName: "Csv Reader",
      email: "csv@example.com",
    });
    const checkout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: copies[0].id });
    expect(checkout.status).toBe(201);

    const fine = await (await api())
      .post("/api/v1/fines")
      .set(session.headers)
      .send({ memberId: member.id, type: "manual", amountCents: 250, note: "Coffee stain" });
    expect(fine.status).toBe(201);

    const loans = await (await api()).get("/api/v1/exports/loans").set(session.headers);
    expect(loans.status).toBe(200);
    expect(loans.headers["content-type"]).toContain("text/csv");
    expect(loans.headers["content-disposition"]).toContain("attachment");
    expect(loans.headers["content-disposition"]).toContain("loans-");
    expect(loans.text).toContain("barcode,title,authors,member,card_number,branch,status");
    expect(loans.text).toContain(copies[0].barcode);
    expect(loans.text).toContain("Csv Reader");
    expect(loans.text).toContain('"Autor, Anna"');
    expect(loans.text.split("\n").filter(Boolean)).toHaveLength(2);

    const members = await (await api()).get("/api/v1/exports/members").set(session.headers);
    expect(members.status).toBe(200);
    expect(members.text).toContain("card_number,full_name,email");
    expect(members.text).toContain("Csv Reader");
    expect(members.text).toContain(member.cardNumber);

    const fines = await (await api()).get("/api/v1/exports/fines").set(session.headers);
    expect(fines.status).toBe(200);
    expect(fines.text).toContain("member,card_number,type,amount,currency,status");
    expect(fines.text).toContain("2.50");
    expect(fines.text).toContain("Coffee stain");

    const unknown = await (await api()).get("/api/v1/exports/users").set(session.headers);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("unknown_export");

    const anonymous = await (await api()).get("/api/v1/exports/loans");
    expect(anonymous.status).toBe(401);
  });

  it("scopes exports to the requesting tenant", async () => {
    const other = await setupLibrary();

    const mine = await (await api()).get("/api/v1/exports/loans").set(session.headers);
    expect(mine.status).toBe(200);

    const others = await (await api()).get("/api/v1/exports/loans").set(other.session.headers);
    expect(others.status).toBe(200);
    expect(others.text.split("\n").filter(Boolean)).toHaveLength(1);
  });
});
