import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { and, asc, desc, eq, gte, ilike, or, sql as dsql } from "drizzle-orm";
import { domains, tenants, users } from "../../db/schema";
import type { TenantPlan, TenantStatus } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { pgErrorCode } from "../../db/pg-errors";
import { conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams, PageParams } from "../../common/pagination";
import { parseTenantSettings, TenantSettings, TenantSettingsSchema } from "./tenant-settings";
import type { AddDomainInput, TenantSettingsPatch } from "./dto";

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function publicTenantRow(row: {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  settings: unknown;
  createdAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    plan: row.plan,
    settings: parseTenantSettings(row.settings),
    createdAt: row.createdAt,
  };
}

@Injectable()
export class TenantsService {
  constructor(private readonly audit: AuditService) {}

  private currentTenantId(): string {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return store.tenantId;
  }

  async getCurrent() {
    const db = getDb();
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, this.currentTenantId()))
      .limit(1);
    const tenant = rows[0];
    if (!tenant) throw notFound("tenant_not_found", "Library account not found");
    return publicTenantRow(tenant);
  }

  async updateSettings(patch: TenantSettingsPatch) {
    const db = getDb();
    const tenantId = this.currentTenantId();
    const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const tenant = rows[0];
    if (!tenant) throw notFound("tenant_not_found", "Library account not found");

    const current = parseTenantSettings(tenant.settings);
    const clean = omitUndefined(patch as Record<string, unknown>);
    const merged: TenantSettings = TenantSettingsSchema.parse({
      ...current,
      ...{ currency: clean.currency, timezone: clean.timezone, locale: clean.locale },
      branding: { ...current.branding, ...omitUndefined((patch.branding ?? {}) as Record<string, unknown>) },
      circulation: {
        ...current.circulation,
        ...omitUndefined((patch.circulation ?? {}) as Record<string, unknown>),
      },
      notifications: {
        ...current.notifications,
        ...omitUndefined((patch.notifications ?? {}) as Record<string, unknown>),
      },
      opac: { ...current.opac, ...omitUndefined((patch.opac ?? {}) as Record<string, unknown>) },
    });

    await db
      .update(tenants)
      .set({ settings: merged as unknown as Record<string, unknown> })
      .where(eq(tenants.id, tenantId));
    await this.audit.log({
      action: "tenant.settings_updated",
      entityType: "tenant",
      entityId: tenantId,
      metadata: { keys: Object.keys(clean) },
    });
    return merged;
  }

  async listDomains() {
    const db = getDb();
    return db
      .select()
      .from(domains)
      .where(eq(domains.tenantId, this.currentTenantId()))
      .orderBy(asc(domains.createdAt));
  }

  async addDomain(input: AddDomainInput) {
    const db = getDb();
    const tenantId = this.currentTenantId();
    const verificationToken = randomBytes(16).toString("hex");
    try {
      const [row] = await db
        .insert(domains)
        .values({ tenantId, domain: input.domain, verificationToken })
        .returning();
      await this.audit.log({
        action: "domain.added",
        entityType: "domain",
        entityId: row.id,
        metadata: { domain: input.domain },
      });
      return row;
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("domain_taken", "That domain is already registered on the platform");
      }
      throw err;
    }
  }

  async verifyDomain(domainId: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(domains)
      .where(and(eq(domains.id, domainId), eq(domains.tenantId, this.currentTenantId())))
      .limit(1);
    const row = rows[0];
    if (!row) throw notFound("domain_not_found", "Domain not found");

    let verified = false;
    let reason = "";
    try {
      const records = await Promise.race([
        resolveTxt(`_lms-verify.${row.domain}`),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      verified = records.some((chunks) => chunks.join("").trim() === row.verificationToken);
      if (!verified) reason = "txt_record_mismatch";
    } catch (err) {
      reason = err instanceof Error && err.message === "timeout" ? "dns_timeout" : "dns_lookup_failed";
    }

    const [updated] = await db
      .update(domains)
      .set({ status: verified ? "verified" : "failed", verifiedAt: verified ? new Date() : null })
      .where(eq(domains.id, row.id))
      .returning();
    await this.audit.log({
      action: verified ? "domain.verified" : "domain.verification_failed",
      entityType: "domain",
      entityId: row.id,
      metadata: { domain: row.domain, reason: reason || undefined },
    });
    return { domain: updated, verified, reason: reason || null };
  }

  async removeDomain(domainId: string) {
    const db = getDb();
    const deleted = await db
      .delete(domains)
      .where(and(eq(domains.id, domainId), eq(domains.tenantId, this.currentTenantId())))
      .returning({ id: domains.id, domain: domains.domain });
    if (deleted.length === 0) throw notFound("domain_not_found", "Domain not found");
    await this.audit.log({
      action: "domain.removed",
      entityType: "domain",
      entityId: domainId,
      metadata: { domain: deleted[0].domain },
    });
  }

  async listAll(query: { q?: string; status?: TenantStatus; page?: number; perPage?: number }) {
    const db = getDb();
    const params = pageParams(query);
    const filters = [];
    if (query.q) {
      filters.push(
        or(ilike(tenants.name, `%${query.q}%`), ilike(tenants.slug, `%${query.q}%`))!,
      );
    }
    if (query.status) filters.push(eq(tenants.status, query.status));
    const where = filters.length > 0 ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        status: tenants.status,
        plan: tenants.plan,
        createdAt: tenants.createdAt,
        userCount: dsql<number>`(select count(*)::int from users where users.tenant_id = tenants.id and users.role in ('tenant_admin','librarian','assistant'))`,
      })
      .from(tenants)
      .where(where)
      .orderBy(desc(tenants.createdAt))
      .limit(params.perPage)
      .offset(params.offset);
    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(tenants)
      .where(where);
    return { items: rows, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async getTenant(id: string) {
    const db = getDb();
    const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    const tenant = rows[0];
    if (!tenant) throw notFound("tenant_not_found", "Tenant not found");
    const [counts] = await db
      .select({
        users: dsql<number>`(select count(*)::int from users where users.tenant_id = tenants.id and users.role in ('tenant_admin','librarian','assistant'))`,
      })
      .from(tenants)
      .where(eq(tenants.id, tenant.id));
    return { ...publicTenantRow(tenant), counts };
  }

  async setStatus(id: string, status: TenantStatus) {
    const db = getDb();
    const [row] = await db
      .update(tenants)
      .set({ status })
      .where(eq(tenants.id, id))
      .returning();
    if (!row) throw notFound("tenant_not_found", "Tenant not found");
    await this.audit.log({
      action: "tenant.status_changed",
      entityType: "tenant",
      entityId: id,
      metadata: { status },
      tenantId: id,
    });
    return publicTenantRow(row);
  }

  async setPlan(id: string, plan: TenantPlan) {
    const db = getDb();
    const [row] = await db.update(tenants).set({ plan }).where(eq(tenants.id, id)).returning();
    if (!row) throw notFound("tenant_not_found", "Tenant not found");
    await this.audit.log({
      action: "tenant.plan_changed",
      entityType: "tenant",
      entityId: id,
      metadata: { plan },
      tenantId: id,
    });
    return publicTenantRow(row);
  }

  async tenantGrowth(days: number) {
    const db = getDb();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        day: dsql<string>`to_char(date_trunc('day', ${tenants.createdAt}), 'YYYY-MM-DD')`,
        count: dsql<number>`count(*)::int`,
      })
      .from(tenants)
      .where(gte(tenants.createdAt, since))
      .groupBy(dsql`date_trunc('day', ${tenants.createdAt})`)
      .orderBy(dsql`date_trunc('day', ${tenants.createdAt})`);
    return rows;
  }
}
