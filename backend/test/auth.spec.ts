import { beforeEach, describe, expect, it } from "vitest";
import {
  api,
  createPlatformAdmin,
  login,
  registerTenant,
  resetDb,
  uniqueSlug,
} from "./helpers";

describe("auth", () => {
  beforeEach(resetDb);

  it("registers a tenant with an admin user and trial plan", async () => {
    const session = await registerTenant({ libraryName: "Riverside" });
    expect(session.token).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();

    const res = await (await api()).get("/api/v1/auth/me").set(session.headers);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(session.email);
    expect(res.body.user.role).toBe("tenant_admin");
    expect(res.body.tenant.slug).toBe(session.slug);
    expect(res.body.tenant.status).toBe("trial");
    expect(res.body.tenant.plan).toBe("free");
  });

  it("rejects duplicate and reserved slugs", async () => {
    const session = await registerTenant();
    const duplicate = await (await api()).post("/api/v1/auth/register").send({
      libraryName: "Copycat",
      slug: session.slug,
      name: "Other Admin",
      email: "other@example.com",
      password: "Password123!",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("slug_taken");

    const reserved = await (await api()).post("/api/v1/auth/register").send({
      libraryName: "Admin Library",
      slug: "admin",
      name: "Sneaky Admin",
      email: "sneaky@example.com",
      password: "Password123!",
    });
    expect(reserved.status).toBe(409);
    expect(reserved.body.error.code).toBe("slug_reserved");
  });

  it("validates the registration payload", async () => {
    const res = await (await api()).post("/api/v1/auth/register").send({
      libraryName: "X",
      slug: "ok",
      name: "A",
      email: "not-an-email",
      password: "short",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("logs in with valid credentials and rejects invalid ones", async () => {
    const session = await registerTenant();

    const ok = await login(session.slug, session.email, session.password);
    expect(ok.status).toBe(200);
    expect(typeof ok.body.accessToken).toBe("string");

    const wrongPassword = await login(session.slug, session.email, "NopeNope123!");
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe("invalid_credentials");

    const wrongEmail = await login(session.slug, "ghost@example.com", session.password);
    expect(wrongEmail.status).toBe(401);

    const wrongSlug = await login(uniqueSlug("nope"), session.email, session.password);
    expect(wrongSlug.status).toBe(401);
  });

  it("requires a bearer token for protected routes", async () => {
    const res = await (await api()).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("rotates refresh tokens and detects reuse", async () => {
    const session = await registerTenant();

    const rotated = await (await api())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(session.refreshToken);

    const reuse = await (await api())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("refresh_reuse");

    const afterReuse = await (await api())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const session = await registerTenant();
    const logout = await (await api())
      .post("/api/v1/auth/logout")
      .send({ refreshToken: session.refreshToken });
    expect(logout.status).toBe(204);

    const refresh = await (await api())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(refresh.status).toBe(401);
    expect(refresh.body.error.code).toBe("invalid_refresh");
  });

  it("changes the password and revokes old sessions", async () => {
    const session = await registerTenant({ password: "Password123!" });

    const changed = await (await api())
      .post("/api/v1/auth/change-password")
      .set(session.headers)
      .send({ currentPassword: "Password123!", newPassword: "NewPassword456!" });
    expect(changed.status).toBe(204);

    const oldRefresh = await (await api())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken });
    expect(oldRefresh.status).toBe(401);

    const oldLogin = await login(session.slug, session.email, "Password123!");
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(session.slug, session.email, "NewPassword456!");
    expect(newLogin.status).toBe(200);
  });

  it("rejects a wrong current password", async () => {
    const session = await registerTenant();
    const res = await (await api())
      .post("/api/v1/auth/change-password")
      .set(session.headers)
      .send({ currentPassword: "WrongPassword1!", newPassword: "NewPassword456!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_password");
  });

  it("supports platform admin login with tenant-null tokens", async () => {
    await registerTenant();
    const platform = await createPlatformAdmin();

    const res = await (await api())
      .post("/api/v1/auth/platform/login")
      .send({ email: platform.email, password: platform.password });
    expect(res.status).toBe(200);
    expect(res.body.tenant).toBeNull();
    expect(res.body.user.role).toBe("platform_admin");

    const token = res.body.accessToken as string;
    const tenants = await (await api())
      .get("/api/v1/tenants")
      .set("Authorization", `Bearer ${token}`);
    expect(tenants.status).toBe(200);
    expect(tenants.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it("does not let tenant admins use platform endpoints", async () => {
    const session = await registerTenant();
    const res = await (await api()).get("/api/v1/tenants").set(session.headers);
    expect(res.status).toBe(403);
  });
});
