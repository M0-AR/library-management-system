import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, or, sql as dsql } from "drizzle-orm";
import { books, branches, copies, domains, tenants } from "../../db/schema";
import { withTenantContext } from "../../db/client";
import { forbidden, notFound } from "../../common/errors";
import { env } from "../../env";
import { pageMeta, pageParams } from "../../common/pagination";
import { parseTenantSettings } from "../tenants/tenant-settings";
import type { PublicBooksQuery } from "./dto";

@Injectable()
export class PublicService {
  async tenantBySlug(slug: string) {
    return withTenantContext({ publicLookup: true }, async (db) => {
      const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
      const tenant = rows[0];
      if (!tenant || (tenant.status !== "active" && tenant.status !== "trial")) {
        throw notFound("tenant_not_found", "Library not found");
      }
      const settings = parseTenantSettings(tenant.settings);
      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        branding: settings.branding,
        opac: settings.opac,
      };
    });
  }

  async catalog(slug: string, query: PublicBooksQuery) {
    const tenant = await this.tenantBySlug(slug);
    return withTenantContext({ tenantId: tenant.id, publicLookup: true }, async (db) => {
      const params = pageParams(query);
      const filters = [eq(books.tenantId, tenant.id), eq(books.status, "active")];
      if (query.q) {
        const pattern = `%${query.q}%`;
        filters.push(
          or(
            ilike(books.title, pattern),
            dsql`${books.authors}::text ilike ${pattern}`,
            dsql`search_vector @@ plainto_tsquery('simple', ${query.q})`,
          )!,
        );
      }
      if (query.category) {
        filters.push(dsql`${books.categories} && array[${query.category}]::text[]`);
      }
      if (query.author) {
        filters.push(dsql`${books.authors}::text ilike ${`%${query.author}%`}`);
      }
      if (query.available) {
        filters.push(
          dsql`exists (select 1 from copies c where c.book_id = ${books.id} and c.status = 'available')`,
        );
      }
      const where = and(...filters);

      const items = await db
        .select({
          id: books.id,
          title: books.title,
          subtitle: books.subtitle,
          authors: books.authors,
          coverUrl: books.coverUrl,
          categories: books.categories,
          publishedYear: books.publishedYear,
          publisher: books.publisher,
          language: books.language,
          isbn13: books.isbn13,
          availableCopies: dsql<number>`(select count(*)::int from copies c where c.book_id = books.id and c.status = 'available')`,
          totalCopies: dsql<number>`(select count(*)::int from copies c where c.book_id = books.id and c.status not in ('withdrawn'))`,
        })
        .from(books)
        .where(where)
        .orderBy(query.sort === "recent" ? desc(books.createdAt) : asc(books.title))
        .limit(params.perPage)
        .offset(params.offset);

      const countRows = await db
        .select({ total: dsql<number>`count(*)::int` })
        .from(books)
        .where(where);
      return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
    });
  }

  async bookDetail(slug: string, bookId: string) {
    const tenant = await this.tenantBySlug(slug);
    return withTenantContext({ tenantId: tenant.id, publicLookup: true }, async (db) => {
      const rows = await db
        .select()
        .from(books)
        .where(and(eq(books.id, bookId), eq(books.tenantId, tenant.id), eq(books.status, "active")))
        .limit(1);
      const book = rows[0];
      if (!book) throw notFound("book_not_found", "Book not found");

      const availabilityRows = await db
        .select({
          branchId: branches.id,
          branchName: branches.name,
          status: copies.status,
          count: dsql<number>`count(*)::int`,
        })
        .from(copies)
        .innerJoin(branches, eq(copies.branchId, branches.id))
        .where(eq(copies.bookId, book.id))
        .groupBy(branches.id, branches.name, copies.status);

      const byBranch = new Map<string, { branchId: string; branchName: string; available: number; total: number }>();
      for (const row of availabilityRows) {
        if (row.status === "withdrawn") continue;
        const entry = byBranch.get(row.branchId) ?? {
          branchId: row.branchId,
          branchName: row.branchName,
          available: 0,
          total: 0,
        };
        entry.total += row.count;
        if (row.status === "available") entry.available += row.count;
        byBranch.set(row.branchId, entry);
      }

      return {
        ...book,
        availability: Array.from(byBranch.values()),
      };
    });
  }

  async categories(slug: string) {
    const tenant = await this.tenantBySlug(slug);
    return withTenantContext({ tenantId: tenant.id, publicLookup: true }, async (db) => {
      const rows = await db.execute(dsql`
        select distinct unnest(categories) as category
        from books
        where tenant_id = ${tenant.id} and status = 'active'
        order by category
      `);
      return (rows as unknown as Array<{ category: string }>).map((row) => row.category);
    });
  }

  async domainAllowed(domain: string): Promise<{ allowed: true }> {
    const host = domain.toLowerCase().split(":")[0];
    const appDomain = env().APP_DOMAIN.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === appDomain || host === `www.${appDomain}`) {
      return { allowed: true };
    }
    if (host.endsWith(`.${appDomain}`)) {
      const sub = host.slice(0, -(appDomain.length + 1));
      const tenant = await this.findTenantBySlugOrHost(sub, null);
      if (tenant) return { allowed: true };
    } else {
      const tenant = await this.findTenantBySlugOrHost(null, host);
      if (tenant) return { allowed: true };
    }
    throw forbidden("domain_not_allowed", "Domain is not configured for on-demand TLS");
  }

  async resolveDomain(domain: string): Promise<{ slug: string | null; name: string | null }> {
    const host = domain.toLowerCase().split(":")[0];
    const appDomain = env().APP_DOMAIN.toLowerCase();
    if (host === appDomain || host === `www.${appDomain}`) {
      return { slug: null, name: null };
    }
    if (host.endsWith(`.${appDomain}`)) {
      const sub = host.slice(0, -(appDomain.length + 1));
      const tenant = await this.findTenantBySlugOrHost(sub, null);
      return tenant ? { slug: tenant.slug, name: tenant.name } : { slug: null, name: null };
    }
    const tenant = await this.findTenantBySlugOrHost(null, host);
    return tenant ? { slug: tenant.slug, name: tenant.name } : { slug: null, name: null };
  }

  private async findTenantBySlugOrHost(slug: string | null, host: string | null) {
    return withTenantContext({ publicLookup: true }, async (db) => {
      if (slug) {
        const rows = await db
          .select({ slug: tenants.slug, name: tenants.name, status: tenants.status })
          .from(tenants)
          .where(eq(tenants.slug, slug))
          .limit(1);
        const tenant = rows[0];
        return tenant && (tenant.status === "active" || tenant.status === "trial") ? tenant : null;
      }
      if (host) {
        const domainRows = await db
          .select({ tenantId: domains.tenantId })
          .from(domains)
          .where(and(eq(domains.domain, host), eq(domains.status, "verified")))
          .limit(1);
        const domainRow = domainRows[0];
        if (!domainRow) return null;
        const rows = await db
          .select({ slug: tenants.slug, name: tenants.name, status: tenants.status })
          .from(tenants)
          .where(eq(tenants.id, domainRow.tenantId))
          .limit(1);
        const tenant = rows[0];
        return tenant && (tenant.status === "active" || tenant.status === "trial") ? tenant : null;
      }
      return null;
    });
  }
}
