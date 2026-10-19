import "./setup/rate-limit-env";
import { beforeEach, describe, expect, it } from "vitest";
import { api, login, registerTenant, resetDb } from "./helpers";

describe("rate limiting", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("throttles login attempts per IP", async () => {
    const attacker = "10.1.1.1";
    for (let i = 0; i < 20; i++) {
      const res = await (await api())
        .post("/api/v1/auth/login")
        .set("X-Forwarded-For", attacker)
        .send({ slug: "nope", email: "nobody@test.dev", password: "Password123!" });
      expect(res.status, `attempt ${i + 1}`).toBe(401);
    }

    const blocked = await (await api())
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", attacker)
      .send({ slug: "nope", email: "nobody@test.dev", password: "Password123!" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("rate_limited");
    expect(blocked.headers["retry-after"]).toBe("300");

    const bystander = await (await api())
      .post("/api/v1/auth/login")
      .set("X-Forwarded-For", "10.1.1.2")
      .send({ slug: "nope", email: "nobody@test.dev", password: "Password123!" });
    expect(bystander.status).toBe(401);
  });

  it("throttles tenant registration per IP", async () => {
    const attacker = "10.2.2.2";
    for (let i = 0; i < 10; i++) {
      const res = await (await api())
        .post("/api/v1/auth/register")
        .set("X-Forwarded-For", attacker)
        .send({
          slug: `rate-limit-${i}-${Date.now() % 100000}`,
          libraryName: `Rate Library ${i}`,
          name: `Rate Owner ${i}`,
          email: `owner${i}@rate.test`,
          password: "Password123!",
        });
      expect(res.status, `register ${i + 1}`).toBe(201);
    }

    const blocked = await (await api())
      .post("/api/v1/auth/register")
      .set("X-Forwarded-For", attacker)
      .send({
        slug: `rate-limit-final-${Date.now() % 100000}`,
        libraryName: "Rate Library Final",
        name: "Rate Owner Final",
        email: "owner-final@rate.test",
        password: "Password123!",
      });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("rate_limited");
  });

  it("throttles sensitive actions per authenticated user", async () => {
    const session = await registerTenant();
    for (let i = 0; i < 10; i++) {
      const res = await (await api())
        .post("/api/v1/auth/change-password")
        .set(session.headers)
        .send({ currentPassword: "WrongPassword1!", newPassword: "NewPassword123!" });
      expect(res.status, `change ${i + 1}`).toBe(401);
    }

    const blocked = await (await api())
      .post("/api/v1/auth/change-password")
      .set(session.headers)
      .send({ currentPassword: "WrongPassword1!", newPassword: "NewPassword123!" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("rate_limited");

    const stillWorks = await login(session.slug, session.email, session.password);
    expect(stillWorks.status).toBe(200);

    const otherUser = await registerTenant();
    const otherChange = await (await api())
      .post("/api/v1/auth/change-password")
      .set(otherUser.headers)
      .send({ currentPassword: "WrongPassword1!", newPassword: "NewPassword123!" });
    expect(otherChange.status).toBe(401);
  });
});
