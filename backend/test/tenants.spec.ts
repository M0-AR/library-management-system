import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  createPlatformAdmin,
  login,
  registerTenant,
  resetDb,
  setupLibrary,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("tenants", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  it("returns the current tenant and restricts staff roles", async () => {
    const res = await (await api()).get("/api/v1/tenants/me").set(session.headers);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(session.slug);
    expect(res.body.settings.currency).toBe("USD");
    expect(res.body.settings.circulation.loanPeriodDays).toBe(14);
    expect(res.body.settings.circulation.maxLoansPerMember).toBe(10);

    const created = await (await api())
      .post("/api/v1/users")
      .set(session.headers)
      .send({
        email: "assistant@test.dev",
        name: "Assistant One",
        password: "Password123!",
        role: "assistant",
      });
    expect(created.status).toBe(201);
    const assistant = await login(session.slug, "assistant@test.dev", "Password123!");
    const denied = await (await api())
      .get("/api/v1/tenants/me")
      .set("Authorization", `Bearer ${assistant.body.accessToken as string}`);
    expect(denied.status).toBe(403);
  });

  it("merges settings patches and applies the new loan period", async () => {
    const patched = await (await api())
      .patch("/api/v1/tenants/me/settings")
      .set(session.headers)
      .send({
        currency: "EUR",
        circulation: { loanPeriodDays: 21 },
        branding: { displayName: "Grand Library", primaryColor: "#111111" },
      });
    expect(patched.status, JSON.stringify(patched.body)).toBe(200);
    expect(patched.body.currency).toBe("EUR");
    expect(patched.body.circulation.loanPeriodDays).toBe(21);
    expect(patched.body.circulation.maxLoansPerMember).toBe(10);
    expect(patched.body.branding.displayName).toBe("Grand Library");
    expect(patched.body.branding.primaryColor).toBe("#111111");

    const readBack = await (await api()).get("/api/v1/tenants/me").set(session.headers);
    expect(readBack.body.settings.currency).toBe("EUR");
    expect(readBack.body.settings.circulation.loanPeriodDays).toBe(21);
    expect(readBack.body.settings.branding.displayName).toBe("Grand Library");

    const invalid = await (await api())
      .patch("/api/v1/tenants/me/settings")
      .set(session.headers)
      .send({ circulation: { loanPeriodDays: 0 } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("validation_failed");

    const still = await (await api()).get("/api/v1/tenants/me").set(session.headers);
    expect(still.body.settings.circulation.loanPeriodDays).toBe(21);

    const book = await createBook(session.token, { title: "Policy Book" });
    const copies = await addCopies(session.token, book.id, branchId, 1);
    const member = await createMember(session.token, { fullName: "Policy Reader" });
    const checkout = await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: copies[0].id });
    expect(checkout.status).toBe(201);
    const dueIn = (new Date(checkout.body.dueAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(dueIn).toBeGreaterThan(20.9);
    expect(dueIn).toBeLessThan(21.1);
  });

  it("manages custom domains", async () => {
    const domain = `library-${Date.now()}.example.org`;
    const added = await (await api())
      .post("/api/v1/tenants/me/domains")
      .set(session.headers)
      .send({ domain });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body.domain).toBe(domain);
    expect(added.body.status).toBe("pending");
    expect(added.body.verificationToken).toMatch(/^[0-9a-f]{32}$/);

    const duplicate = await (await api())
      .post("/api/v1/tenants/me/domains")
      .set(session.headers)
      .send({ domain });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("domain_taken");

    const invalid = await (await api())
      .post("/api/v1/tenants/me/domains")
      .set(session.headers)
      .send({ domain: "not a domain" });
    expect(invalid.status).toBe(400);

    const list = await (await api()).get("/api/v1/tenants/me/domains").set(session.headers);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(added.body.id);

    const verified = await (await api())
      .post(`/api/v1/tenants/me/domains/${added.body.id}/verify`)
      .set(session.headers)
      .send({});
    expect(verified.status).toBe(201);
    expect(verified.body.verified).toBe(false);
    expect(["dns_lookup_failed", "dns_timeout", "txt_record_mismatch"]).toContain(
      verified.body.reason,
    );
    expect(verified.body.domain.status).toBe("failed");

    const other = await registerTenant();
    const stolen = await (await api())
      .post("/api/v1/tenants/me/domains")
      .set(other.headers)
      .send({ domain });
    expect(stolen.status).toBe(409);
    expect(stolen.body.error.code).toBe("domain_taken");

    const removed = await (await api())
      .delete(`/api/v1/tenants/me/domains/${added.body.id}`)
      .set(session.headers);
    expect(removed.status).toBe(200);
    const empty = await (await api()).get("/api/v1/tenants/me/domains").set(session.headers);
    expect(empty.body).toHaveLength(0);

    const again = await (await api())
      .delete(`/api/v1/tenants/me/domains/${added.body.id}`)
      .set(session.headers);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe("domain_not_found");
  });

  it("gives platform admins tenant oversight", async () => {
    const other = await registerTenant();
    const platform = await createPlatformAdmin();
    const platformLogin = await (await api())
      .post("/api/v1/auth/platform/login")
      .send({ email: platform.email, password: platform.password });
    expect(platformLogin.status, JSON.stringify(platformLogin.body)).toBe(200);
    const platformHeaders = {
      Authorization: `Bearer ${platformLogin.body.accessToken as string}`,
    };

    const forbidden = await (await api()).get("/api/v1/tenants").set(session.headers);
    expect(forbidden.status).toBe(403);

    const all = await (await api()).get("/api/v1/tenants").set(platformHeaders);
    expect(all.status, JSON.stringify(all.body)).toBe(200);
    expect(all.body.meta.total).toBeGreaterThanOrEqual(2);
    const otherRow = all.body.items.find((t: { slug: string }) => t.slug === other.slug);
    expect(otherRow).toBeTruthy();
    expect(otherRow.userCount).toBe(1);

    const filtered = await (await api())
      .get(`/api/v1/tenants?q=${other.slug}`)
      .set(platformHeaders);
    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.items[0].id).toBe(other.tenantId);

    const detail = await (await api())
      .get(`/api/v1/tenants/${other.tenantId}`)
      .set(platformHeaders);
    expect(detail.status).toBe(200);
    expect(detail.body.counts.users).toBe(1);

    const missing = await (await api())
      .get("/api/v1/tenants/00000000-0000-4000-8000-000000000000")
      .set(platformHeaders);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("tenant_not_found");

    const suspended = await (await api())
      .patch(`/api/v1/tenants/${other.tenantId}/status`)
      .set(platformHeaders)
      .send({ status: "suspended" });
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe("suspended");

    const blocked = await (await api()).get("/api/v1/books").set(other.headers);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("tenant_suspended");

    const reactivated = await (await api())
      .patch(`/api/v1/tenants/${other.tenantId}/status`)
      .set(platformHeaders)
      .send({ status: "active" });
    expect(reactivated.body.status).toBe("active");
    const works = await (await api()).get("/api/v1/books").set(other.headers);
    expect(works.status).toBe(200);

    const planned = await (await api())
      .patch(`/api/v1/tenants/${other.tenantId}/plan`)
      .set(platformHeaders)
      .send({ plan: "starter" });
    expect(planned.status).toBe(200);
    expect(planned.body.plan).toBe("starter");

    const growth = await (await api())
      .get("/api/v1/tenants/growth?days=30")
      .set(platformHeaders);
    expect(growth.status).toBe(200);
    expect(growth.body.length).toBeGreaterThanOrEqual(1);
    const totalNew = growth.body.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0,
    );
    expect(totalNew).toBeGreaterThanOrEqual(2);
    expect(growth.body[growth.body.length - 1].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
