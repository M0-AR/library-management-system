import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  createMember,
  createPlatformAdmin,
  registerTenant,
  resetDb,
  setupLibrary,
  withAdmin,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("public (opac)", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
    branchId = setup.branch.id;
  });

  async function seedBooks() {
    const dune = await createBook(session.token, {
      title: "Dune",
      authors: ["Frank Herbert"],
      categories: ["Science Fiction"],
      publishedYear: 1965,
    });
    const hobbit = await createBook(session.token, {
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      categories: ["Fantasy"],
      publishedYear: 1937,
    });
    const jade = await createBook(session.token, {
      title: "Jade Legacy",
      authors: ["Fonda Lee"],
      categories: ["Fantasy"],
      publishedYear: 2021,
    });
    return { dune, hobbit, jade };
  }

  it("serves tenant branding and hides unavailable tenants", async () => {
    const res = await (await api()).get(`/api/v1/public/tenants/${session.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(session.slug);
    expect(res.body.name).toBe(session.libraryName);
    expect(res.body.branding.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(res.body.opac.enabled).toBe(true);

    const missing = await (await api()).get("/api/v1/public/tenants/does-not-exist");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("tenant_not_found");

    const platform = await createPlatformAdmin();
    const platformLogin = await (await api())
      .post("/api/v1/auth/platform/login")
      .send({ email: platform.email, password: platform.password });
    const platformHeaders = {
      Authorization: `Bearer ${platformLogin.body.accessToken as string}`,
    };

    await (await api())
      .patch(`/api/v1/tenants/${session.tenantId}/status`)
      .set(platformHeaders)
      .send({ status: "suspended" });
    const suspended = await (await api()).get(`/api/v1/public/tenants/${session.slug}`);
    expect(suspended.status).toBe(404);

    await (await api())
      .patch(`/api/v1/tenants/${session.tenantId}/status`)
      .set(platformHeaders)
      .send({ status: "active" });
    const restored = await (await api()).get(`/api/v1/public/tenants/${session.slug}`);
    expect(restored.status).toBe(200);
  });

  it("serves the catalog with search, filters and live availability", async () => {
    const { dune, hobbit, jade } = await seedBooks();

    const duneCopies = await addCopies(session.token, dune.id, branchId, 2);
    await addCopies(session.token, hobbit.id, branchId, 1);

    const member = await createMember(session.token, { fullName: "Opac Reader" });
    await (await api())
      .post("/api/v1/loans/checkout")
      .set(session.headers)
      .send({ memberId: member.id, copyId: duneCopies[0].id });

    const archived = await createBook(session.token, { title: "Gone With The Wind" });
    await (await api())
      .post(`/api/v1/books/${archived.id}/status`)
      .set(session.headers)
      .send({ status: "archived" });

    const catalog = await (await api()).get(`/api/v1/public/tenants/${session.slug}/books`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.meta.total).toBe(3);
    expect(catalog.body.items.map((b: { title: string }) => b.title)).toEqual([
      "Dune",
      "Jade Legacy",
      "The Hobbit",
    ]);
    const duneRow = catalog.body.items.find((b: { id: string }) => b.id === dune.id);
    expect(duneRow.availableCopies).toBe(1);
    expect(duneRow.totalCopies).toBe(2);
    expect(duneRow.availableCopies).toBeLessThanOrEqual(duneRow.totalCopies);

    const search = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books?q=tolkien`,
    );
    expect(search.body.meta.total).toBe(1);
    expect(search.body.items[0].id).toBe(hobbit.id);

    const byCategory = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books?category=Fantasy`,
    );
    expect(byCategory.body.meta.total).toBe(2);

    const availableNow = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books?available=true`,
    );
    expect(availableNow.body.meta.total).toBe(2);
    expect(
      (availableNow.body.items as Array<{ id: string }>).map((b) => b.id).sort(),
    ).toEqual([dune.id, hobbit.id].sort());

    const byAuthor = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books?author=herbert`,
    );
    expect(byAuthor.body.meta.total).toBe(1);
    expect(byAuthor.body.items[0].id).toBe(dune.id);

    const recent = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books?sort=recent&perPage=1`,
    );
    expect(recent.body.meta.total).toBe(3);
    expect(recent.body.items).toHaveLength(1);
    expect(recent.body.items[0].id).toBe(jade.id);

    const categories = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/categories`,
    );
    expect(categories.status).toBe(200);
    expect(categories.body).toEqual(["Fantasy", "Science Fiction"]);

    const other = await registerTenant();
    const otherCatalog = await (await api()).get(`/api/v1/public/tenants/${other.slug}/books`);
    expect(otherCatalog.body.meta.total).toBe(0);
  });

  it("serves book detail with per-branch availability", async () => {
    const { dune } = await seedBooks();
    const copies = await addCopies(session.token, dune.id, branchId, 2);

    const branchB = await (await api())
      .post("/api/v1/branches")
      .set(session.headers)
      .send({ name: "Second Branch", code: "SEC" });
    expect(branchB.status, JSON.stringify(branchB.body)).toBe(201);
    await addCopies(session.token, dune.id, branchB.body.id, 1);

    const withdrawn = await (await api())
      .delete(`/api/v1/copies/${copies[1].id}`)
      .set(session.headers);
    expect(withdrawn.status).toBe(204);

    const detail = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books/${dune.id}`,
    );
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    expect(detail.body.title).toBe("Dune");
    expect(detail.body.availability).toHaveLength(2);
    const first = detail.body.availability.find(
      (a: { branchId: string }) => a.branchId === branchId,
    );
    const second = detail.body.availability.find(
      (a: { branchId: string }) => a.branchId === branchB.body.id,
    );
    expect(first.available).toBe(1);
    expect(first.total).toBe(1);
    expect(second.available).toBe(1);
    expect(second.total).toBe(1);

    const hidden = await createBook(session.token, { title: "Draft Book" });
    await (await api())
      .post(`/api/v1/books/${hidden.id}/status`)
      .set(session.headers)
      .send({ status: "archived" });
    const archivedDetail = await (await api()).get(
      `/api/v1/public/tenants/${session.slug}/books/${hidden.id}`,
    );
    expect(archivedDetail.status).toBe(404);

    const other = await registerTenant();
    const crossTenant = await (await api()).get(
      `/api/v1/public/tenants/${other.slug}/books/${dune.id}`,
    );
    expect(crossTenant.status).toBe(404);
  });

  it("resolves platform and custom domains", async () => {
    const localhost = await (await api()).get("/api/v1/public/domains/allow?domain=localhost");
    expect(localhost.status).toBe(200);
    expect(localhost.body.allowed).toBe(true);

    const subAllow = await (await api()).get(
      `/api/v1/public/domains/allow?domain=${session.slug}.localhost`,
    );
    expect(subAllow.status).toBe(200);
    expect(subAllow.body.allowed).toBe(true);

    const denyUnknownSub = await (await api()).get(
      "/api/v1/public/domains/allow?domain=nope.localhost",
    );
    expect(denyUnknownSub.status).toBe(403);
    expect(denyUnknownSub.body.error.code).toBe("domain_not_allowed");

    const denyRandom = await (await api()).get(
      "/api/v1/public/domains/allow?domain=example.org",
    );
    expect(denyRandom.status).toBe(403);
    expect(denyRandom.body.error.code).toBe("domain_not_allowed");

    const resolved = await (await api()).get(
      `/api/v1/public/domains/resolve?domain=${session.slug}.localhost`,
    );
    expect(resolved.body.slug).toBe(session.slug);
    expect(resolved.body.name).toBe(session.libraryName);

    const platform = await (await api()).get("/api/v1/public/domains/resolve?domain=localhost");
    expect(platform.body.slug).toBeNull();

    const unknownSub = await (await api()).get(
      "/api/v1/public/domains/resolve?domain=nope.localhost",
    );
    expect(unknownSub.body.slug).toBeNull();

    const custom = `books-${Date.now()}.example.org`;
    const added = await (await api())
      .post("/api/v1/tenants/me/domains")
      .set(session.headers)
      .send({ domain: custom });
    expect(added.status).toBe(201);

    const pending = await (await api()).get(
      `/api/v1/public/domains/resolve?domain=${custom}`,
    );
    expect(pending.body.slug).toBeNull();

    await withAdmin(async (sql) => {
      await sql`update domains set status = 'verified', verified_at = now() where id = ${added.body.id}`;
    });

    const customResolve = await (await api()).get(
      `/api/v1/public/domains/resolve?domain=${custom}`,
    );
    expect(customResolve.body.slug).toBe(session.slug);
    expect(customResolve.body.name).toBe(session.libraryName);

    const customAllow = await (await api()).get(
      `/api/v1/public/domains/allow?domain=${custom}`,
    );
    expect(customAllow.status).toBe(200);
    expect(customAllow.body.allowed).toBe(true);
  });
});
