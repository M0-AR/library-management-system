import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, sql as dsql } from "drizzle-orm";
import { books, copies, fines, holds, loans, members } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { forbidden } from "../../common/errors";

@Injectable()
export class DashboardService {
  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId };
  }

  async summary() {
    const db = getDb();
    const { tenantId } = this.ctx();

    const [bookStats] = await db
      .select({
        titles: dsql<number>`count(*)::int`,
        archived: dsql<number>`count(*) filter (where ${books.status} = 'archived')::int`,
      })
      .from(books)
      .where(eq(books.tenantId, tenantId));

    const [copyStats] = await db
      .select({
        total: dsql<number>`count(*)::int`,
        available: dsql<number>`count(*) filter (where ${copies.status} = 'available')::int`,
        onLoan: dsql<number>`count(*) filter (where ${copies.status} = 'on_loan')::int`,
        reserved: dsql<number>`count(*) filter (where ${copies.status} = 'reserved')::int`,
        lost: dsql<number>`count(*) filter (where ${copies.status} = 'lost')::int`,
      })
      .from(copies)
      .where(eq(copies.tenantId, tenantId));

    const [memberStats] = await db
      .select({
        total: dsql<number>`count(*)::int`,
        active: dsql<number>`count(*) filter (where ${members.status} = 'active')::int`,
        suspended: dsql<number>`count(*) filter (where ${members.status} = 'suspended')::int`,
        newThisMonth: dsql<number>`count(*) filter (where ${members.joinedAt} >= date_trunc('month', current_date))::int`,
      })
      .from(members)
      .where(eq(members.tenantId, tenantId));

    const [loanStats] = await db
      .select({
        active: dsql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
        overdue: dsql<number>`count(*) filter (where (${loans.status} = 'overdue' or (${loans.status} = 'active' and ${loans.dueAt} < now())))::int`,
        checkedOutToday: dsql<number>`count(*) filter (where ${loans.checkedOutAt} >= current_date)::int`,
        returnedToday: dsql<number>`count(*) filter (where ${loans.returnedAt} >= current_date)::int`,
        checkedOutThisMonth: dsql<number>`count(*) filter (where ${loans.checkedOutAt} >= date_trunc('month', current_date))::int`,
      })
      .from(loans)
      .where(eq(loans.tenantId, tenantId));

    const [holdStats] = await db
      .select({
        pending: dsql<number>`count(*) filter (where ${holds.status} = 'pending')::int`,
        ready: dsql<number>`count(*) filter (where ${holds.status} = 'ready')::int`,
      })
      .from(holds)
      .where(eq(holds.tenantId, tenantId));

    const [fineStats] = await db
      .select({
        outstandingCents: dsql<number>`coalesce(sum(case when ${fines.status} = 'outstanding' then ${fines.amountCents} else 0 end),0)::int`,
        outstandingCount: dsql<number>`count(*) filter (where ${fines.status} = 'outstanding')::int`,
      })
      .from(fines)
      .where(eq(fines.tenantId, tenantId));

    return {
      books: bookStats,
      copies: copyStats,
      members: memberStats,
      loans: loanStats,
      holds: holdStats,
      fines: fineStats,
    };
  }

  async circulationSeries(days: number) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const span = Math.min(90, Math.max(7, Math.round(days)));
    const rows = (await db.execute(dsql`
      with day_series as (
        select generate_series(
          (current_date - make_interval(days => ${span - 1}))::date,
          current_date,
          interval '1 day'
        )::date as day
      ),
      checkout_counts as (
        select checked_out_at::date as day, count(*)::int as n
        from loans
        where tenant_id = ${tenantId}
        group by 1
      ),
      return_counts as (
        select returned_at::date as day, count(*)::int as n
        from loans
        where tenant_id = ${tenantId} and returned_at is not null
        group by 1
      )
      select
        to_char(day_series.day, 'YYYY-MM-DD') as day,
        coalesce(checkout_counts.n, 0) as checkouts,
        coalesce(return_counts.n, 0) as returns
      from day_series
      left join checkout_counts on checkout_counts.day = day_series.day
      left join return_counts on return_counts.day = day_series.day
      order by day_series.day
    `)) as unknown as Array<{ day: string; checkouts: number; returns: number }>;
    return rows;
  }

  async topTitles(days: number, limit: number) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const since = new Date(Date.now() - Math.min(365, Math.max(1, days)) * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        bookId: books.id,
        title: books.title,
        authors: books.authors,
        loanCount: dsql<number>`count(*)::int`,
      })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .where(and(eq(loans.tenantId, tenantId), gte(loans.checkedOutAt, since)))
      .groupBy(books.id, books.title, books.authors)
      .orderBy(desc(dsql`count(*)`))
      .limit(Math.min(20, Math.max(1, limit)));
    return rows;
  }

  async recentCheckouts(limit: number) {
    const db = getDb();
    const { tenantId } = this.ctx();
    return db
      .select({
        loanId: loans.id,
        checkedOutAt: loans.checkedOutAt,
        dueAt: loans.dueAt,
        bookTitle: books.title,
        memberName: members.fullName,
        copyBarcode: copies.barcode,
      })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .innerJoin(copies, eq(loans.copyId, copies.id))
      .where(eq(loans.tenantId, tenantId))
      .orderBy(desc(loans.checkedOutAt))
      .limit(Math.min(20, Math.max(1, limit)));
  }
}
