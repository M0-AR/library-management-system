import { beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import type { Sql } from "postgres";
import { createBook, registerTenant, resetDb, withAdmin } from "./helpers";
import type { TenantSession } from "./helpers";

async function withAppRole<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL as string, { max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function selectTitlesWithContext(tenantId: string | null, platform = false): Promise<string[]> {
  return withAppRole(async (sql) => {
    return sql.begin(async (tx) => {
      if (tenantId) {
        await tx`select set_config('app.current_tenant', ${tenantId}, true)`;
      }
      if (platform) {
        await tx`select set_config('app.is_platform_admin', 'true', true)`;
      }
      const rows = await tx<Array<{ title: string }>>`select title from books order by title`;
      return rows.map((row) => row.title);
    });
  });
}

describe("row level security", () => {
  let tenantA: TenantSession;
  let tenantB: TenantSession;

  beforeEach(async () => {
    await resetDb();
    tenantA = await registerTenant();
    tenantB = await registerTenant();
    await createBook(tenantA.token, { title: "Alpha Only" });
    await createBook(tenantB.token, { title: "Beta Only" });
  });

  it("runs the application as a non-owner role without BYPASSRLS", async () => {
    const rows = await withAppRole(
      (sql) => sql<Array<{ rolbypassrls: boolean; rolsuper: boolean }>>`
        select rolbypassrls, rolsuper from pg_roles where rolname = 'app_user'`,
    );
    expect(rows[0]?.rolbypassrls).toBe(false);
    expect(rows[0]?.rolsuper).toBe(false);
  });

  it("forces row level security on tenant tables", async () => {
    const rows = await withAdmin(
      (sql) => sql<Array<{ relforcerowsecurity: boolean }>>`
        select relforcerowsecurity from pg_class where relname = 'books'`,
    );
    expect(rows[0]?.relforcerowsecurity).toBe(true);
  });

  it("returns no tenant rows without a tenant context", async () => {
    expect(await selectTitlesWithContext(null)).toEqual([]);
  });

  it("isolates tenants from each other", async () => {
    expect(await selectTitlesWithContext(tenantA.tenantId)).toEqual(["Alpha Only"]);
    expect(await selectTitlesWithContext(tenantB.tenantId)).toEqual(["Beta Only"]);
  });

  it("lets a platform admin see across tenants", async () => {
    const titles = await selectTitlesWithContext(null, true);
    expect(titles).toEqual(["Alpha Only", "Beta Only"]);
  });

  it("rejects inserting rows for another tenant", async () => {
    await expect(
      withAppRole(async (sql) => {
        await sql.begin(async (tx) => {
          await tx`select set_config('app.current_tenant', ${tenantA.tenantId}, true)`;
          await tx`
            insert into members (tenant_id, card_number, full_name)
            values (${tenantB.tenantId}, 'RLS-1', 'Mallory Intruder')`;
        });
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects updating rows of another tenant", async () => {
    await expect(
      withAppRole(async (sql) => {
        await sql.begin(async (tx) => {
          await tx`select set_config('app.current_tenant', ${tenantA.tenantId}, true)`;
          const updated = await tx`
            update books set title = 'Hijacked' where tenant_id = ${tenantB.tenantId}
            returning id`;
          expect(updated).toHaveLength(0);
        });
      }),
    ).resolves.toBeUndefined();
    const titles = await selectTitlesWithContext(tenantB.tenantId);
    expect(titles).toEqual(["Beta Only"]);
  });

  it("does not leak refresh tokens across tenants even for platform admins", async () => {
    const rows = await withAppRole((sql) =>
      sql.begin(async (tx) => {
        await tx`select set_config('app.is_platform_admin', 'true', true)`;
        return tx<Array<{ count: number }>>`select count(*)::int as count from refresh_tokens`;
      }),
    );
    expect(rows[0]?.count).toBe(0);
  });
});
