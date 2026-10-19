import { afterAll, expect, inject } from "vitest";
import request from "supertest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Sql } from "postgres";

let testDbPort = 55440;
try {
  const provided = inject("testDbPort");
  if (typeof provided === "number") testDbPort = provided;
} catch {
  // running outside the vitest global setup; fall back to the default port
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= `postgres://app_user:testpass@127.0.0.1:${testDbPort}/lms_test`;
process.env.DATABASE_URL_ADMIN ??= `postgres://postgres:testpass@127.0.0.1:${testDbPort}/postgres`;
process.env.JWT_SECRET ??= "test-jwt-secret-0123456789abcdef";
process.env.RATE_LIMIT_ENABLED ??= "false";
process.env.JOBS_ENABLED ??= "false";
process.env.BILLING_PROVIDER ??= "stub";
process.env.PADDLE_WEBHOOK_SECRET ??= "test-webhook-secret";
process.env.APP_DOMAIN ??= "localhost";

let app: NestFastifyApplication | null = null;

export async function getApp(): Promise<NestFastifyApplication> {
  if (app) return app;
  const [
    { env, resetEnvCache },
    { initDb },
    { AppModule },
    { NestFactory },
    { FastifyAdapter },
    { configureApp },
  ] = await Promise.all([
    import("../src/env"),
    import("../src/db/client"),
    import("../src/app.module"),
    import("@nestjs/core"),
    import("@nestjs/platform-fastify"),
    import("../src/app.setup"),
  ]);
  resetEnvCache();
  await initDb(env().DATABASE_URL, { max: 10 });
  const created = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { rawBody: true, logger: process.env.TEST_APP_LOG === "1" ? ["error", "warn"] : false },
  );
  await configureApp(created);
  await created.init();
  await created.getHttpAdapter().getInstance().ready();
  app = created;
  return app;
}

export async function api() {
  const instance = await getApp();
  return request(instance.getHttpAdapter().getInstance().server);
}

function adminUrl(): string {
  const url = new URL(process.env.DATABASE_URL_ADMIN as string);
  url.pathname = new URL(process.env.DATABASE_URL as string).pathname;
  return url.toString();
}

export async function withAdmin<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(adminUrl(), {
    max: 1,
    onnotice: () => {},
  });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function resetDb(): Promise<void> {
  await withAdmin(async (sql) => {
    await sql.unsafe(
      "truncate table audit_logs, refresh_tokens, notifications, fines, holds, loans, copies, books, members, users, branches, domains, tenants restart identity cascade",
    );
  });
}

export function uniqueSlug(prefix = "lib"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`.toLowerCase();
}

export interface TenantSession {
  token: string;
  refreshToken: string;
  tenantId: string;
  slug: string;
  libraryName: string;
  email: string;
  password: string;
  userId: string;
  headers: { Authorization: string };
}

export async function registerTenant(
  overrides: Partial<{
    slug: string;
    email: string;
    password: string;
    name: string;
    libraryName: string;
  }> = {},
): Promise<TenantSession> {
  const slug = overrides.slug ?? uniqueSlug();
  const email = overrides.email ?? `admin-${slug}@example.com`;
  const password = overrides.password ?? "Password123!";
  const libraryName = overrides.libraryName ?? "Test Library";
  const res = await (await api()).post("/api/v1/auth/register").send({
    libraryName,
    slug,
    name: overrides.name ?? "Test Admin",
    email,
    password,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const token = res.body.accessToken as string;
  return {
    token,
    refreshToken: res.body.refreshToken as string,
    tenantId: res.body.tenant.id as string,
    slug: res.body.tenant.slug as string,
    libraryName,
    email,
    password,
    userId: res.body.user.id as string,
    headers: { Authorization: `Bearer ${token}` },
  };
}

export async function login(
  slug: string,
  email: string,
  password: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await (await api()).post("/api/v1/auth/login").send({ slug, email, password });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

export async function createPlatformAdmin(
  email = "platform@test.dev",
  password = "Password123!",
): Promise<{ email: string; password: string }> {
  const { hashPassword } = await import("../src/modules/auth/password");
  const hash = await hashPassword(password);
  await withAdmin(async (sql) => {
    await sql`insert into users (tenant_id, email, password_hash, name, role)
      values (null, ${email}, ${hash}, 'Platform Admin', 'platform_admin')`;
  });
  return { email, password };
}

export interface BookRow {
  id: string;
  title: string;
  authors: string[];
  status: string;
}

export async function createBook(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<BookRow> {
  const res = await (await api())
    .post("/api/v1/books")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: `Book ${Math.random().toString(36).slice(2, 8)}`,
      authors: ["Test Author"],
      ...overrides,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as BookRow;
}

export interface CopyRow {
  id: string;
  barcode: string;
  status: string;
  branchId: string;
}

export async function mainBranch(token: string): Promise<{ id: string; code: string }> {
  const res = await (await api()).get("/api/v1/branches").set("Authorization", `Bearer ${token}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const rows = (Array.isArray(res.body) ? res.body : (res.body.items ?? [])) as Array<{
    id: string;
    code: string;
  }>;
  const branch = rows.find((row) => row.code === "MAIN") ?? rows[0];
  expect(branch, "expected a default branch").toBeTruthy();
  return branch;
}

export async function addCopies(
  token: string,
  bookId: string,
  branchId: string,
  count = 1,
): Promise<CopyRow[]> {
  const res = await (await api())
    .post(`/api/v1/books/${bookId}/copies`)
    .set("Authorization", `Bearer ${token}`)
    .send({ branchId, count });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const body = res.body as
    | CopyRow[]
    | { copies?: CopyRow[]; items?: CopyRow[]; id?: string; barcode?: string };
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.copies)) return body.copies;
  if (Array.isArray(body.items)) return body.items;
  if (body.id && body.barcode) return [body as CopyRow];
  return [];
}

export interface MemberRow {
  id: string;
  cardNumber: string;
  fullName: string;
  status: string;
}

export async function createMember(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<MemberRow> {
  const res = await (await api())
    .post("/api/v1/members")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fullName: `Member ${Math.random().toString(36).slice(2, 8)}`,
      ...overrides,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as MemberRow;
}

export async function setupLibrary(): Promise<{
  session: TenantSession;
  branch: { id: string; code: string };
}> {
  const session = await registerTenant();
  const branch = await mainBranch(session.token);
  return { session, branch };
}

afterAll(async () => {
  if (app) {
    await app.close();
    app = null;
  }
  try {
    const { closeDb } = await import("../src/db/client");
    await closeDb();
  } catch {
    // db was never initialized
  }
});
