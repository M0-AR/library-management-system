import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { api, createMember, createPlatformAdmin, login, resetDb, setupLibrary } from "./helpers";
import type { TenantSession } from "./helpers";

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";
type Role = "tenant_admin" | "librarian" | "assistant" | "patron" | "platform_admin";

interface RouteInfo {
  controller: string;
  method: HttpMethod;
  path: string;
  roles: Role[] | null;
  isPublic: boolean;
}

const PUBLIC_ALLOWLIST = new Set([
  "post /auth/register",
  "post /auth/login",
  "post /auth/platform/login",
  "post /auth/refresh",
  "post /auth/logout",
  "post /billing/webhook",
  "get /public/tenants/:slug",
  "get /public/tenants/:slug/books",
  "get /public/tenants/:slug/categories",
  "get /public/tenants/:slug/books/:bookId",
  "get /public/domains/allow",
  "get /public/domains/resolve",
  "get /health",
]);

const PUBLIC_401_OK = new Set([
  "post /auth/refresh",
  "post /auth/logout",
  "post /billing/webhook",
]);

const ANY_AUTH_ALLOWLIST = new Set(["get /auth/me", "post /auth/change-password"]);

const MODULES_DIR = fileURLToPath(new URL("../src/modules", import.meta.url));
const METHOD_RE = /@(Get|Post|Patch|Put|Delete)\(\s*(?:"([^"]*)")?\s*\)/;
const DECORATOR_RE = /^\s*@(HttpCode|RateLimit|Public|Roles|Header|Version)\b/;

const FIXED_PARAMS: Record<string, string> = {
  cardNumber: "M0000000",
  resource: "loans",
  isbn: "9780000000000",
  slug: "matrix",
};

function controllerFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...controllerFiles(full));
    else if (entry.name.endsWith(".controller.ts")) files.push(full);
  }
  return files.sort();
}

function parseRoles(line: string): Role[] {
  return [...line.matchAll(/"(\w+)"/g)].map((match) => match[1] as Role);
}

function nextSignificant(lines: string[], from: number): string {
  for (let i = from + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (DECORATOR_RE.test(lines[i])) continue;
    return trimmed;
  }
  return "";
}

function parseRoutes(file: string): RouteInfo[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const routes: RouteInfo[] = [];
  let controller: string | null = null;
  let classRoles: Role[] | null = null;
  let classPublic = false;
  let nextClassRoles: Role[] | null = null;
  let nextClassPublic = false;
  let methodRoles: Role[] | null = null;
  let methodPublic = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/@Roles\(/.test(line)) {
      const roles = parseRoles(line);
      if (nextSignificant(lines, i).startsWith("@Controller")) nextClassRoles = roles;
      else methodRoles = roles;
      continue;
    }
    if (/@Public\(\)/.test(line)) {
      if (nextSignificant(lines, i).startsWith("@Controller")) nextClassPublic = true;
      else methodPublic = true;
      continue;
    }
    if (/@Controller\(/.test(line)) {
      controller = line.match(/@Controller\("([^"]*)"\)/)?.[1] ?? "";
      classRoles = nextClassRoles;
      classPublic = nextClassPublic;
      nextClassRoles = null;
      nextClassPublic = false;
      methodRoles = null;
      methodPublic = false;
      continue;
    }
    const methodMatch = line.match(METHOD_RE);
    if (!methodMatch || controller === null) continue;
    const sub = methodMatch[2] ?? "";
    routes.push({
      controller,
      method: methodMatch[1].toLowerCase() as HttpMethod,
      path: `/${[controller, sub].filter(Boolean).join("/")}`,
      roles: methodRoles ?? classRoles,
      isPublic: methodPublic || classPublic,
    });
    methodRoles = null;
    methodPublic = false;
  }
  return routes;
}

function substitute(path: string): string {
  return path.replace(/:([A-Za-z]+)/g, (_match, name: string) => FIXED_PARAMS[name] ?? randomUUID());
}

const allRoutes = controllerFiles(MODULES_DIR).flatMap((file) => parseRoutes(file));

const byController = new Map<string, RouteInfo[]>();
for (const route of allRoutes) {
  const list = byController.get(route.controller) ?? [];
  list.push(route);
  byController.set(route.controller, list);
}
const controllers = [...byController.keys()].sort();

const ROLE_NAMES: Role[] = ["tenant_admin", "librarian", "assistant", "patron", "platform_admin"];

interface Identity {
  label: string;
  role: Role;
  token: string;
}

async function call(route: RouteInfo, path: string, token?: string): Promise<number> {
  const client = await api();
  const method = route.method as "get" | "post" | "patch" | "put" | "delete";
  let req = client[method](`/api/v1${path}`);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  if (route.method !== "get") req = req.send({});
  const res = await req;
  return res.status;
}

describe("authorization matrix", () => {
  let session: TenantSession;
  let identities: Record<string, Identity>;
  let anonymous: { label: string };

  beforeEach(async () => {
    await resetDb();
    const setup = await setupLibrary();
    session = setup.session;

    const createStaff = async (role: "librarian" | "assistant"): Promise<string> => {
      const email = `${role}@matrix.test`;
      const created = await (await api())
        .post("/api/v1/users")
        .set(session.headers)
        .send({ email, name: `Matrix ${role}`, password: "Password123!", role });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const auth = await login(session.slug, email, "Password123!");
      expect(auth.status, JSON.stringify(auth.body)).toBe(200);
      return auth.body.accessToken as string;
    };

    const librarianToken = await createStaff("librarian");
    const assistantToken = await createStaff("assistant");

    const member = await createMember(session.token, { fullName: "Matrix Patron" });
    const patronEmail = "patron@matrix.test";
    const patronUser = await (await api())
      .post("/api/v1/users")
      .set(session.headers)
      .send({
        email: patronEmail,
        name: "Matrix Patron",
        password: "Password123!",
        role: "patron",
        memberId: member.id,
      });
    expect(patronUser.status, JSON.stringify(patronUser.body)).toBe(201);
    const patronAuth = await login(session.slug, patronEmail, "Password123!");
    expect(patronAuth.status, JSON.stringify(patronAuth.body)).toBe(200);

    const platform = await createPlatformAdmin("platform@matrix.test");
    const platformAuth = await (await api())
      .post("/api/v1/auth/platform/login")
      .send(platform);
    expect(platformAuth.status, JSON.stringify(platformAuth.body)).toBe(200);

    anonymous = { label: "anonymous" };
    identities = {
      tenant_admin: { label: "tenant_admin", role: "tenant_admin", token: session.token },
      librarian: { label: "librarian", role: "librarian", token: librarianToken },
      assistant: { label: "assistant", role: "assistant", token: assistantToken },
      patron: { label: "patron", role: "patron", token: patronAuth.body.accessToken as string },
      platform_admin: {
        label: "platform_admin",
        role: "platform_admin",
        token: platformAuth.body.accessToken as string,
      },
    };
  });

  it("discovers a plausible route inventory", () => {
    expect(allRoutes.length).toBeGreaterThan(50);
    for (const route of allRoutes) {
      expect(route.path.startsWith("/"), `${route.method} ${route.path}`).toBe(true);
    }
    expect(byController.size).toBeGreaterThan(10);
  });

  describe.each(controllers)("%s", (controllerName) => {
    const routes = byController.get(controllerName) as RouteInfo[];

    it("enforces the role matrix on every route", async () => {
      for (const route of routes) {
        const path = substitute(route.path);
        const label = `${route.method.toUpperCase()} /api/v1${path}`;

        if (route.isPublic) {
          const key = `${route.method} ${route.path}`;
          expect(PUBLIC_ALLOWLIST.has(key), `unexpected public route ${key}`).toBe(true);
          const anonStatus = await call(route, path);
          expect(anonStatus, `${label} should not be forbidden`).not.toBe(403);
          if (!PUBLIC_401_OK.has(key)) {
            expect(anonStatus, `${label} should reach the handler (got ${anonStatus})`).not.toBe(401);
          }
          continue;
        }

        const anonStatus = await call(route, path);
        expect(anonStatus, `${label} without a token`).toBe(401);

        if (route.roles === null) {
          const key = `${route.method} ${route.path}`;
          expect(
            ANY_AUTH_ALLOWLIST.has(key),
            `role-less route ${key} must be explicitly allowlisted`,
          ).toBe(true);
        }

        for (const identity of Object.values(identities)) {
          const status = await call(route, path, identity.token);
          const allowed = route.roles === null || route.roles.includes(identity.role);
          const where = `${label} as ${identity.label} (got ${status})`;
          if (allowed) {
            expect(status, `${where} should be allowed`).not.toBe(401);
            expect(status, `${where} should be allowed`).not.toBe(403);
            expect(status, `${where} should not crash`).toBeLessThan(500);
          } else {
            expect(status, `${where} should be forbidden`).toBe(403);
          }
        }
      }
    });
  });

  it("never grants an unknown role more than its own role set", () => {
    for (const route of allRoutes) {
      if (route.roles === null) continue;
      for (const role of route.roles) {
        expect(ROLE_NAMES, `unknown role ${role} on ${route.method} ${route.path}`).toContain(role);
      }
    }
    expect(anonymous.label).toBe("anonymous");
  });
});
