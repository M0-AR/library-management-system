import { beforeEach, describe, expect, it } from "vitest";
import {
  api,
  createMember,
  login,
  registerTenant,
  resetDb,
  setupLibrary,
  withAdmin,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("users", () => {
  let session: TenantSession;

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;
  });

  async function createUser(body: Record<string, unknown>) {
    return (await api()).post("/api/v1/users").set(session.headers).send(body);
  }

  const assistant = {
    email: "staff@test.dev",
    name: "Staff Member",
    password: "Password123!",
    role: "assistant" as const,
  };

  it("creates staff and patron accounts", async () => {
    const created = await createUser(assistant);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.role).toBe("assistant");
    expect(created.body.status).toBe("active");
    expect(created.body).not.toHaveProperty("passwordHash");

    const staffLogin = await login(session.slug, assistant.email, assistant.password);
    expect(staffLogin.status).toBe(200);

    const member = await createMember(session.token, { fullName: "Portal Patron" });
    const patron = await createUser({
      email: "patron@test.dev",
      name: "Portal Patron",
      password: "Password123!",
      role: "patron",
      memberId: member.id,
    });
    expect(patron.status, JSON.stringify(patron.body)).toBe(201);
    expect(patron.body.role).toBe("patron");

    await withAdmin(async (sql) => {
      const rows = await sql`select user_id from members where id = ${member.id}`;
      expect(rows[0].user_id).toBe(patron.body.id);
    });

    const patronLogin = await login(session.slug, "patron@test.dev", "Password123!");
    expect(patronLogin.status).toBe(200);

    const duplicate = await createUser(assistant);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("email_taken");

    const relink = await createUser({
      email: "patron2@test.dev",
      name: "Second Patron",
      password: "Password123!",
      role: "patron",
      memberId: member.id,
    });
    expect(relink.status).toBe(409);
    expect(relink.body.error.code).toBe("member_already_linked");

    const noMember = await createUser({
      email: "bare@test.dev",
      name: "Bare Patron",
      password: "Password123!",
      role: "patron",
    });
    expect(noMember.status).toBe(400);

    const staffWithMember = await createUser({
      email: "staff2@test.dev",
      name: "Staff Two",
      password: "Password123!",
      role: "librarian",
      memberId: member.id,
    });
    expect(staffWithMember.status).toBe(400);

    const badBranch = await createUser({
      email: "staff3@test.dev",
      name: "Staff Three",
      password: "Password123!",
      role: "assistant",
      branchId: "00000000-0000-4000-8000-000000000000",
    });
    expect(badBranch.status).toBe(400);
    expect(badBranch.body.error.code).toBe("branch_not_found");

    const staffLoginForbidden = await (async () => {
      const l = await login(session.slug, assistant.email, assistant.password);
      return (await api())
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${l.body.accessToken as string}`)
        .send({ ...assistant, email: "denied@test.dev" });
    })();
    expect(staffLoginForbidden.status).toBe(403);
  });

  it("lists and fetches users", async () => {
    await createUser(assistant);
    await createUser({ ...assistant, email: "librarian@test.dev", role: "librarian" });

    const all = await (await api()).get("/api/v1/users").set(session.headers);
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(3);

    const byRole = await (await api())
      .get("/api/v1/users?role=assistant")
      .set(session.headers);
    expect(byRole.body.meta.total).toBe(1);

    const byQuery = await (await api()).get("/api/v1/users?q=librarian").set(session.headers);
    expect(byQuery.body.items[0].email).toBe("librarian@test.dev");

    const staff = await login(session.slug, assistant.email, assistant.password);
    const staffList = await (await api())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${staff.body.accessToken as string}`);
    expect(staffList.status).toBe(403);

    const librarian = await login(session.slug, "librarian@test.dev", assistant.password);
    const librarianList = await (await api())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${librarian.body.accessToken as string}`);
    expect(librarianList.status).toBe(200);

    const detail = await (await api())
      .get(`/api/v1/users/${byRole.body.items[0].id}`)
      .set(session.headers);
    expect(detail.status).toBe(200);
    expect(detail.body.email).toBe(assistant.email);

    const missing = await (await api())
      .get("/api/v1/users/00000000-0000-4000-8000-000000000000")
      .set(session.headers);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("user_not_found");
  });

  it("updates users and enforces account guards", async () => {
    const created = await createUser(assistant);

    const updated = await (await api())
      .patch(`/api/v1/users/${created.body.id}`)
      .set(session.headers)
      .send({ role: "librarian", name: "Renamed Staff" });
    expect(updated.status).toBe(200);
    expect(updated.body.role).toBe("librarian");
    expect(updated.body.name).toBe("Renamed Staff");

    const missing = await (await api())
      .patch("/api/v1/users/00000000-0000-4000-8000-000000000000")
      .set(session.headers)
      .send({ name: "Ghost" });
    expect(missing.status).toBe(404);

    const selfDisable = await (await api())
      .delete(`/api/v1/users/${session.userId}`)
      .set(session.headers);
    expect(selfDisable.status).toBe(400);
    expect(selfDisable.body.error.code).toBe("self_disable");

    const other = await registerTenant();
    const cross = await (await api())
      .delete(`/api/v1/users/${created.body.id}`)
      .set(other.headers);
    expect(cross.status).toBe(404);
  });

  it("resets passwords and revokes sessions", async () => {
    const created = await createUser(assistant);
    const first = await login(session.slug, assistant.email, assistant.password);
    const refreshToken = first.body.refreshToken as string;

    const tooShort = await (await api())
      .post(`/api/v1/users/${created.body.id}/reset-password`)
      .set(session.headers)
      .send({ newPassword: "short" });
    expect(tooShort.status).toBe(400);

    const reset = await (await api())
      .post(`/api/v1/users/${created.body.id}/reset-password`)
      .set(session.headers)
      .send({ newPassword: "NewPassword456!" });
    expect(reset.status).toBe(204);

    const oldLogin = await login(session.slug, assistant.email, assistant.password);
    expect(oldLogin.status).toBe(401);
    const newLogin = await login(session.slug, assistant.email, "NewPassword456!");
    expect(newLogin.status).toBe(200);

    const refresh = await (await api())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });
    expect(refresh.status).toBe(401);

    const missing = await (await api())
      .post("/api/v1/users/00000000-0000-4000-8000-000000000000/reset-password")
      .set(session.headers)
      .send({ newPassword: "NewPassword456!" });
    expect(missing.status).toBe(404);
  });

  it("disables users and blocks their sessions", async () => {
    const created = await createUser(assistant);
    const staff = await login(session.slug, assistant.email, assistant.password);
    const staffToken = staff.body.accessToken as string;

    const alive = await (await api())
      .get("/api/v1/books")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(alive.status).toBe(200);

    const disabled = await (await api())
      .delete(`/api/v1/users/${created.body.id}`)
      .set(session.headers);
    expect(disabled.status).toBe(204);

    const blocked = await (await api())
      .get("/api/v1/books")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe("account_inactive");

    const relogin = await login(session.slug, assistant.email, assistant.password);
    expect(relogin.status).toBe(403);
    expect(relogin.body.error.code).toBe("account_disabled");

    const list = await (await api()).get("/api/v1/users?status=disabled").set(session.headers);
    expect(list.body.meta.total).toBe(1);

    const again = await (await api())
      .delete(`/api/v1/users/${created.body.id}`)
      .set(session.headers);
    expect(again.status).toBe(204);
  });
});
