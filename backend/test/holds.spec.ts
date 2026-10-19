import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  getApp,
  registerTenant,
  resetDb,
  setupLibrary,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("holds", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  async function place(bookId: string, memberId: string) {
    return (await api())
      .post("/api/v1/holds")
      .set(session.headers)
      .send({ bookId, memberId });
  }

  it("places a hold and auto-allocates an available copy", async () => {
    const book = await createBook(session.token, { title: "Ready Hold" });
    const copies = await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Hold Member" });

    const res = await place(book.id, member.id);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.status).toBe("ready");
    expect(res.body.readyAt).toBeTruthy();
    const expiryDays =
      (new Date(res.body.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(expiryDays).toBeGreaterThan(2.9);
    expect(expiryDays).toBeLessThan(3.1);

    const copyList = await (await api())
      .get(`/api/v1/books/${book.id}/copies`)
      .set(session.headers);
    expect(copyList.body.find((row: { id: string }) => row.id === copies[0].id).status).toBe(
      "reserved",
    );
  });

  it("queues holds FIFO when no copies are available and promotes on cancel", async () => {
    const book = await createBook(session.token, { title: "Queue Hold" });
    const copies = await addCopies(session.token, book.id, branchId, 1);
    const borrower = await createMember(session.token, { fullName: "Borrower" });
    const first = await createMember(session.token, { fullName: "First Waiter" });
    const second = await createMember(session.token, { fullName: "Second Waiter" });

    const checkout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: borrower.id, copyId: copies[0].id });
    expect(checkout.status).toBe(201);

    const holdOne = await place(book.id, first.id);
    expect(holdOne.status).toBe(201);
    expect(holdOne.body.status).toBe("pending");
    const holdTwo = await place(book.id, second.id);
    expect(holdTwo.body.status).toBe("pending");

    const pending = await (await api())
      .get("/api/v1/holds?status=pending")
      .set(session.headers);
    expect(pending.body.items.map((row: { memberName: string }) => row.memberName)).toEqual([
      "First Waiter",
      "Second Waiter",
    ]);

    const checkin = await (await api())
      .post("/api/v1/loans/checkin")
      .set(session.headers)
      .send({ copyId: copies[0].id });
    expect(checkin.status).toBe(200);
    expect(checkin.body.nextHold.memberId).toBe(first.id);

    const cancelReady = await (await api())
      .post(`/api/v1/holds/${holdOne.body.id}/cancel`)
      .set(session.headers);
    expect(cancelReady.status, JSON.stringify(cancelReady.body)).toBe(200);
    expect(cancelReady.body.status).toBe("cancelled");

    const promoted = await (await api())
      .get(`/api/v1/holds/${holdTwo.body.id}`)
      .set(session.headers);
    expect(promoted.body.status).toBe("ready");

    const copyList = await (await api())
      .get(`/api/v1/books/${book.id}/copies`)
      .set(session.headers);
    expect(copyList.body[0].status).toBe("reserved");
  });

  it("rejects duplicate open holds", async () => {
    const book = await createBook(session.token, { title: "Duplicate Hold" });
    await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Repeat Holder" });

    await place(book.id, member.id);
    const again = await place(book.id, member.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("hold_exists");
  });

  it("rejects holds for inactive members and archived books", async () => {
    const book = await createBook(session.token, { title: "Reject Hold" });
    await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Closed Member" });
    await (await api())
      .patch(`/api/v1/members/${member.id}`)
      .set(session.headers)
      .send({ status: "closed" });

    const inactive = await place(book.id, member.id);
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.code).toBe("member_inactive");

    const active = await createMember(session.token, { fullName: "Active Member" });
    await (await api())
      .post(`/api/v1/books/${book.id}/status`)
      .set(session.headers)
      .send({ status: "archived" });
    const archived = await place(book.id, active.id);
    expect(archived.status).toBe(409);
    expect(archived.body.error.code).toBe("book_archived");

    const ghost = await place("00000000-0000-4000-8000-000000000000", active.id);
    expect(ghost.status).toBe(404);
    expect(ghost.body.error.code).toBe("book_not_found");

    const reactivated = await (await api())
      .post(`/api/v1/books/${book.id}/status`)
      .set(session.headers)
      .send({ status: "active" });
    expect(reactivated.status).toBe(201);
    const missingMember = await place(book.id, "00000000-0000-4000-8000-000000000000");
    expect(missingMember.status).toBe(404);
    expect(missingMember.body.error.code).toBe("member_not_found");
  });

  it("respects the holdsEnabled setting", async () => {
    const book = await createBook(session.token, { title: "Disabled Hold" });
    await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "No Holds" });

    await (await api())
      .patch("/api/v1/tenants/me/settings")
      .set(session.headers)
      .send({ circulation: { holdsEnabled: false } });

    const res = await place(book.id, member.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("holds_disabled");
  });

  it("lists and filters holds", async () => {
    const book = await createBook(session.token, { title: "Listed Hold" });
    await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "List Holder" });
    const hold = await place(book.id, member.id);

    const byMember = await (await api())
      .get(`/api/v1/holds?memberId=${member.id}`)
      .set(session.headers);
    expect(byMember.body.meta.total).toBe(1);

    const byBook = await (await api())
      .get(`/api/v1/holds?bookId=${book.id}`)
      .set(session.headers);
    expect(byBook.body.meta.total).toBe(1);
    expect(byBook.body.items[0].bookTitle).toBe("Listed Hold");

    const byQuery = await (await api())
      .get("/api/v1/holds?q=List+Holder")
      .set(session.headers);
    expect(byQuery.body.meta.total).toBe(1);

    const ready = await (await api())
      .get("/api/v1/holds?status=ready")
      .set(session.headers);
    expect(ready.body.items).toHaveLength(1);

    const cancelAgain = await (await api())
      .post(`/api/v1/holds/${hold.body.id}/cancel`)
      .set(session.headers);
    expect(cancelAgain.status).toBe(200);
    const recancelled = await (await api())
      .post(`/api/v1/holds/${hold.body.id}/cancel`)
      .set(session.headers);
    expect(recancelled.status).toBe(409);
    expect(recancelled.body.error.code).toBe("hold_not_open");
  });

  it("expires stale ready holds and releases reserved copies", async () => {
    const book = await createBook(session.token, { title: "Expiring Hold" });
    const copies = await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Expiring Holder" });
    const hold = await place(book.id, member.id);
    expect(hold.body.status).toBe("ready");

    const { HoldsService } = await import("../src/modules/holds/holds.service");
    const app = await getApp();
    const holdsService = app.get(HoldsService);

    const { withTenantContext } = await import("../src/db/client");
    const expired = await withTenantContext({ tenantId: session.tenantId }, async () => {
      const { getDb } = await import("../src/db/client");
      const db = getDb();
      const { holds } = await import("../src/db/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(holds).set({ expiresAt: new Date(Date.now() - 3600_000) }).where(eq(holds.id, hold.body.id));
      return holdsService.expireStaleHolds();
    });
    expect(expired).toBe(1);

    const after = await (await api())
      .get(`/api/v1/holds/${hold.body.id}`)
      .set(session.headers);
    expect(after.body.status).toBe("expired");

    const copyList = await (await api())
      .get(`/api/v1/books/${book.id}/copies`)
      .set(session.headers);
    expect(copyList.body.find((row: { id: string }) => row.id === copies[0].id).status).toBe(
      "available",
    );
  });

  it("isolates holds across tenants", async () => {
    const book = await createBook(session.token, { title: "Private Hold" });
    await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Private Holder" });
    const hold = await place(book.id, member.id);

    const other = await registerTenant();
    const peek = await (await api()).get(`/api/v1/holds/${hold.body.id}`).set(other.headers);
    expect(peek.status).toBe(404);

    const list = await (await api()).get("/api/v1/holds").set(other.headers);
    expect(list.body.meta.total).toBe(0);

    const theft = await (await api())
      .post("/api/v1/holds")
      .set(other.headers)
      .send({ bookId: book.id, memberId: member.id });
    expect(theft.status).toBe(404);
  });
});
