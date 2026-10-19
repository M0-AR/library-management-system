import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, gt, inArray, lte, sql as dsql } from "drizzle-orm";
import { books, copies, loans, members, notifications, tenants } from "../../db/schema";
import { withTenantContext } from "../../db/client";
import { env } from "../../env";
import { HoldsService } from "../holds/holds.service";
import { NotificationsService } from "../notifications/notifications.service";
import { fineForOverdue, overdueDays } from "../loans/circulation";
import { parseTenantSettings } from "../tenants/tenant-settings";

const DUE_SOON_HORIZON_MS = 3 * 24 * 60 * 60 * 1000;
const OVERDUE_REMINDER_INTERVAL = "6 days";
const SWEEP_BATCH_LIMIT = 500;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly holds: HoldsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("0 */15 * * * *")
  async holdMaintenance(): Promise<void> {
    if (!env().JOBS_ENABLED) return;
    await this.runSweep("hold-maintenance", (tenantId) =>
      withTenantContext({ tenantId }, async () => this.holds.expireStaleHolds()),
    );
  }

  @Cron("0 5 * * * *")
  async overdueSweep(): Promise<void> {
    if (!env().JOBS_ENABLED) return;
    await this.runSweep("overdue-sweep", (tenantId) =>
      withTenantContext({ tenantId }, async (db) => {
        const tenantRows = await db
          .select({ settings: tenants.settings })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        const settings = parseTenantSettings(tenantRows[0]?.settings);
        const now = new Date();

        const dueLoans = await db
          .select({ loan: loans, member: members, bookTitle: books.title })
          .from(loans)
          .innerJoin(members, eq(members.id, loans.memberId))
          .innerJoin(copies, eq(copies.id, loans.copyId))
          .innerJoin(books, eq(books.id, copies.bookId))
          .where(and(eq(loans.status, "active"), lte(loans.dueAt, now)))
          .limit(SWEEP_BATCH_LIMIT);

        if (dueLoans.length > 0) {
          await db
            .update(loans)
            .set({ status: "overdue", updatedAt: now })
            .where(
              and(
                eq(loans.status, "active"),
                inArray(
                  loans.id,
                  dueLoans.map((row) => row.loan.id),
                ),
              ),
            );
        }

        let notified = 0;
        for (const row of dueLoans) {
          const recentReminder = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(
                eq(notifications.loanId, row.loan.id),
                eq(notifications.template, "overdue"),
                dsql`${notifications.createdAt} > now() - interval '${dsql.raw(OVERDUE_REMINDER_INTERVAL)}'`,
              ),
            )
            .limit(1);
          if (recentReminder.length > 0) continue;
          const days = overdueDays(row.loan.dueAt, now);
          await this.notifications.sendOverdue({
            member: row.member,
            bookTitle: row.bookTitle,
            dueAt: row.loan.dueAt,
            fineCents: fineForOverdue(days, settings.circulation),
            loanId: row.loan.id,
          });
          notified += 1;
        }
        return { markedOverdue: dueLoans.length, notified };
      }),
    );
  }

  @Cron("0 30 8 * * *")
  async dueSoonReminders(): Promise<void> {
    if (!env().JOBS_ENABLED) return;
    await this.runSweep("due-soon-reminders", (tenantId) =>
      withTenantContext({ tenantId }, async (db) => {
        const now = new Date();
        const horizon = new Date(now.getTime() + DUE_SOON_HORIZON_MS);
        const candidates = await db
          .select({ loan: loans, member: members, bookTitle: books.title })
          .from(loans)
          .innerJoin(members, eq(members.id, loans.memberId))
          .innerJoin(copies, eq(copies.id, loans.copyId))
          .innerJoin(books, eq(books.id, copies.bookId))
          .where(and(eq(loans.status, "active"), gt(loans.dueAt, now), lte(loans.dueAt, horizon)))
          .limit(SWEEP_BATCH_LIMIT);

        let notified = 0;
        for (const row of candidates) {
          const alreadySent = await db
            .select({ id: notifications.id })
            .from(notifications)
            .where(
              and(eq(notifications.loanId, row.loan.id), eq(notifications.template, "due_soon")),
            )
            .limit(1);
          if (alreadySent.length > 0) continue;
          await this.notifications.sendDueSoon({
            member: row.member,
            bookTitle: row.bookTitle,
            dueAt: row.loan.dueAt,
            loanId: row.loan.id,
          });
          notified += 1;
        }
        return { candidates: candidates.length, notified };
      }),
    );
  }

  private async activeTenantIds(): Promise<string[]> {
    return withTenantContext({ isPlatformAdmin: true, platformLogin: true }, async (db) => {
      const rows = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(inArray(tenants.status, ["active", "trial"]));
      return rows.map((row) => row.id);
    });
  }

  private async runSweep(name: string, work: (tenantId: string) => Promise<unknown>): Promise<void> {
    if (this.running.has(name)) {
      this.logger.warn(`Job ${name} is still running; skipping this tick`);
      return;
    }
    this.running.add(name);
    try {
      const tenantIds = await this.activeTenantIds();
      let processed = 0;
      for (const tenantId of tenantIds) {
        try {
          await work(tenantId);
          processed += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Job ${name} failed for tenant ${tenantId}: ${message}`);
        }
      }
      this.logger.log(`Job ${name} processed ${processed}/${tenantIds.length} tenants`);
    } finally {
      this.running.delete(name);
    }
  }
}
