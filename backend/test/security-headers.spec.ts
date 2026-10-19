import { beforeEach, describe, expect, it } from "vitest";
import { addCopies, api, createBook, mainBranch, registerTenant, resetDb } from "./helpers";

describe("security headers and CORS", () => {
  beforeEach(resetDb);

  it("applies helmet hardening headers to API responses", async () => {
    const res = await (await api()).get("/api/v1/public/tenants/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("allows the configured origin and rejects unknown origins", async () => {
    const client = await api();

    const allowed = await client
      .get("/api/v1/public/tenants/does-not-exist")
      .set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await client
      .get("/api/v1/public/tenants/does-not-exist")
      .set("Origin", "https://evil.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();

    const preflight = await client
      .options("/api/v1/public/tenants/does-not-exist")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");
    expect([200, 204]).toContain(preflight.status);
    expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("compresses large API responses", async () => {
    const session = await registerTenant({ libraryName: "Compression Library" });
    const branch = await mainBranch(session.token);
    for (let i = 0; i < 20; i += 1) {
      const book = await createBook(session.token, {
        title: `Compression Volume ${i}`,
        description: "A".repeat(400),
      });
      await addCopies(session.token, book.id, branch.id, 1);
    }

    const res = await (await api())
      .get(`/api/v1/public/tenants/${session.slug}/books?limit=20`)
      .set("Accept-Encoding", "gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
  });
});
