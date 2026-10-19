import { beforeEach, describe, expect, it } from "vitest";
import { api, createBook, resetDb, setupLibrary } from "./helpers";
import type { TenantSession } from "./helpers";

describe("audit logs", () => {
  let session: TenantSession;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
  });

  it("lists tenant audit entries for admins with filters", async () => {
    const book = await createBook(session.token, { title: "Audited Book" });

    const list = await (await api()).get("/api/v1/audit-logs").set(session.headers);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);
    const entry = (list.body.items as Array<Record<string, unknown>>).find(
      (row) => row.action === "book.created",
    );
    expect(entry).toBeTruthy();
    expect(entry!.entityType).toBe("book");
    expect(entry!.entityId).toBe(book.id);
    expect(entry!.actorEmail).toBe(session.email);

    const filtered = await (await api())
      .get("/api/v1/audit-logs?action=book.created")
      .set(session.headers);
    expect(filtered.status).toBe(200);
    expect(
      (filtered.body.items as Array<Record<string, unknown>>).every(
        (row) => row.action === "book.created",
      ),
    ).toBe(true);

    const none = await (await api())
      .get("/api/v1/audit-logs?entityType=domain")
      .set(session.headers);
    expect(none.body.meta.total).toBe(0);
  });

  it("hides other tenants and requires admin role", async () => {
    const book = await createBook(session.token, { title: "Private Audit" });
    const other = await setupLibrary();
    const otherList = await (await api()).get("/api/v1/audit-logs").set(other.session.headers);
    expect(otherList.status).toBe(200);
    const leaked = (otherList.body.items as Array<Record<string, unknown>>).filter(
      (row) => row.entityId === book.id || row.action === "book.created",
    );
    expect(leaked).toHaveLength(0);

    const anonymous = await (await api()).get("/api/v1/audit-logs");
    expect(anonymous.status).toBe(401);
  });
});
