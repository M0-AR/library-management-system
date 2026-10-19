import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, or, sql as dsql } from "drizzle-orm";
import { books, copies, fines, holds, loans, members, tenants } from "../../db/schema";
import type { LoanStatus } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { pgErrorCode } from "../../db/pg-errors";
import { conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams } from "../../common/pagination";
import { parseTenantSettings } from "../tenants/tenant-settings";
import { NotificationsService } from "../notifications/notifications.service";
import { canCheckout, canRenew, computeDueDate, fineForOverdue, overdueDays } from "./circulation";
import type { CheckinInput, CheckoutInput, ListLoansQuery } from "./dto";

const REASON_MESSAGES: Record<string, string> = {
  member_suspended: "This membership is suspended",
  membership_expired: "This membership has expired",
  membership_closed: "This membership is closed",
  already_borrowed: "This copy is already checked out to this member",
  fines_exceeded: "Outstanding fines exceed the allowed limit",
  loan_limit_reached: "This member has reached the loan limit",
  renewal_limit_reached: "This loan has reached the renewal limit",
  loan_overdue: "Overdue loans cannot be renewed until returned",
  holds_waiting: "Another member is waiting for this title",
  already_returned: "This loan is already closed",
};

@Injectable()
export class LoansService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId, actorId: store.userId ?? null };
  }

  private async policy() {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return parseTenantSettings(rows[0]?.settings).circulation;
  }

  async checkout(input: CheckoutInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();

    const copyRows = input.copyId
      ? await db
          .select()
          .from(copies)
          .where(and(eq(copies.id, input.copyId), eq(copies.tenantId, tenantId)))
          .limit(1)
      : await db
          .select()
          .from(copies)
          .where(and(eq(copies.barcode, input.barcode!), eq(copies.tenantId, tenantId)))
          .limit(1);
    const copy = copyRows[0];
    if (!copy) throw notFound("copy_not_found", "No copy matches that barcode");

    const memberRows = input.memberId
      ? await db
          .select()
          .from(members)
          .where(and(eq(members.id, input.memberId), eq(members.tenantId, tenantId)))
          .limit(1)
      : await db
          .select()
          .from(members)
          .where(and(eq(members.cardNumber, input.cardNumber!), eq(members.tenantId, tenantId)))
          .limit(1);
    const member = memberRows[0];
    if (!member) throw notFound("member_not_found", "No member matches that card number");

    const policy = await this.policy();

    const openHolds = await db
      .select()
      .from(holds)
      .where(and(eq(holds.bookId, copy.bookId), inArray(holds.status, ["pending", "ready"])))
      .orderBy(asc(holds.placedAt));
    const firstHold = openHolds[0];
    if (firstHold && firstHold.memberId !== member.id) {
      throw conflict(
        "hold_queue",
        "This title is on hold for another member. You can fulfill their hold from the holds queue.",
      );
    }

    if (copy.status !== "available" && copy.status !== "reserved") {
      throw conflict(
        "copy_unavailable",
        copy.status === "on_loan"
          ? "This copy is already checked out"
          : `This copy is marked as ${copy.status}`,
      );
    }
    if (copy.status === "reserved" && (!firstHold || firstHold.memberId !== member.id)) {
      throw conflict("copy_reserved", "This copy is reserved for another member");
    }

    const [loanStats] = await db
      .select({ active: dsql<number>`count(*)::int` })
      .from(loans)
      .where(
        and(
          eq(loans.memberId, member.id),
          dsql`${loans.status} in ('active','overdue')`,
        ),
      );
    const [fineStats] = await db
      .select({ outstanding: dsql<number>`coalesce(sum(${fines.amountCents}),0)::int` })
      .from(fines)
      .where(and(eq(fines.memberId, member.id), eq(fines.status, "outstanding")));

    const today = new Date().toISOString().slice(0, 10);
    const effectiveStatus =
      member.expiresAt && member.expiresAt < today ? ("expired" as const) : member.status;
    const decision = canCheckout(
      {
        memberStatus: effectiveStatus,
        activeLoans: loanStats?.active ?? 0,
        outstandingFineCents: fineStats?.outstanding ?? 0,
        alreadyBorrowingCopy: false,
      },
      policy,
    );
    if (!decision.allowed) {
      throw conflict(decision.reason!, REASON_MESSAGES[decision.reason!] ?? "Checkout not allowed");
    }

    const now = new Date();
    const dueAt = computeDueDate(now, policy);
    let loan: typeof loans.$inferSelect;
    try {
      [loan] = await db
        .insert(loans)
        .values({
          tenantId,
          copyId: copy.id,
          bookId: copy.bookId,
          memberId: member.id,
          branchId: copy.branchId,
          checkedOutBy: actorId,
          dueAt,
        })
        .returning();
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("copy_unavailable", "This copy is already checked out");
      }
      throw err;
    }
    await db.update(copies).set({ status: "on_loan" }).where(eq(copies.id, copy.id));

    if (firstHold && firstHold.memberId === member.id) {
      await db.update(holds).set({ status: "fulfilled" }).where(eq(holds.id, firstHold.id));
    }

    await this.audit.log({
      action: "loan.checkout",
      entityType: "loan",
      entityId: loan.id,
      actorUserId: actorId,
      metadata: { barcode: copy.barcode, cardNumber: member.cardNumber, dueAt: dueAt.toISOString() },
    });
    return this.detail(loan.id);
  }

  async checkin(input: CheckinInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();

    const copyRows = input.copyId
      ? await db
          .select()
          .from(copies)
          .where(and(eq(copies.id, input.copyId), eq(copies.tenantId, tenantId)))
          .limit(1)
      : await db
          .select()
          .from(copies)
          .where(and(eq(copies.barcode, input.barcode!), eq(copies.tenantId, tenantId)))
          .limit(1);
    const copy = copyRows[0];
    if (!copy) throw notFound("copy_not_found", "No copy matches that barcode");

    const loanRows = await db
      .select()
      .from(loans)
      .where(and(eq(loans.copyId, copy.id), dsql`${loans.status} in ('active','overdue')`))
      .orderBy(desc(loans.checkedOutAt))
      .limit(1);
    const loan = loanRows[0];
    if (!loan) {
      throw conflict("not_on_loan", "This copy is not currently checked out");
    }

    const policy = await this.policy();
    const now = new Date();
    const days = overdueDays(loan.dueAt, now);
    const fineCents = fineForOverdue(days, policy);

    await db
      .update(loans)
      .set({ status: "returned", returnedAt: now, checkedInBy: actorId })
      .where(eq(loans.id, loan.id));

    let fineId: string | null = null;
    if (fineCents > 0) {
      const [fine] = await db
        .insert(fines)
        .values({
          tenantId,
          memberId: loan.memberId,
          loanId: loan.id,
          type: "overdue",
          amountCents: fineCents,
          createdBy: actorId,
          note: `${days} day(s) overdue`,
        })
        .returning({ id: fines.id });
      fineId = fine.id;
    }

    const nextHoldRows = await db
      .select()
      .from(holds)
      .where(and(eq(holds.bookId, loan.bookId), eq(holds.status, "pending")))
      .orderBy(asc(holds.placedAt))
      .limit(1);
    const nextHold = nextHoldRows[0];

    if (nextHold) {
      const holdExpiry = new Date(now.getTime() + policy.holdShelfExpiryDays * 24 * 60 * 60 * 1000);
      await db.update(copies).set({ status: "reserved" }).where(eq(copies.id, copy.id));
      await db
        .update(holds)
        .set({ status: "ready", readyAt: now, expiresAt: holdExpiry })
        .where(eq(holds.id, nextHold.id));
      const [memberRow] = await db
        .select()
        .from(members)
        .where(eq(members.id, nextHold.memberId))
        .limit(1);
      const [bookRow] = await db.select().from(books).where(eq(books.id, loan.bookId)).limit(1);
      if (memberRow && bookRow) {
        await this.notifications.sendHoldReady({
          member: memberRow,
          bookTitle: bookRow.title,
          expiresAt: holdExpiry,
        });
      }
    } else {
      await db.update(copies).set({ status: "available" }).where(eq(copies.id, copy.id));
    }

    await this.audit.log({
      action: "loan.checkin",
      entityType: "loan",
      entityId: loan.id,
      actorUserId: actorId,
      metadata: { barcode: copy.barcode, overdueDays: days, fineCents },
    });

    return {
      loanId: loan.id,
      overdueDays: days,
      fineCents,
      fineId,
      copyStatus: nextHold ? "reserved" : "available",
      nextHold: nextHold ? { id: nextHold.id, memberId: nextHold.memberId } : null,
      detail: await this.detail(loan.id),
    };
  }

  async renew(loanId: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const rows = await db
      .select()
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.tenantId, tenantId)))
      .limit(1);
    const loan = rows[0];
    if (!loan) throw notFound("loan_not_found", "Loan not found");

    const policy = await this.policy();
    const [holdCount] = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(holds)
      .where(
        and(
          eq(holds.bookId, loan.bookId),
          inArray(holds.status, ["pending", "ready"]),
          dsql`${holds.memberId} <> ${loan.memberId}`,
        ),
      );
    const decision = canRenew(
      { status: loan.status, dueAt: loan.dueAt, renewedCount: loan.renewedCount },
      policy,
      holdCount?.total ?? 0,
    );
    if (!decision.allowed) {
      throw conflict(decision.reason!, REASON_MESSAGES[decision.reason!] ?? "Renewal not allowed");
    }

    const newDueAt = new Date(loan.dueAt.getTime() + policy.renewalPeriodDays * 24 * 60 * 60 * 1000);
    await db
      .update(loans)
      .set({ dueAt: newDueAt, renewedCount: loan.renewedCount + 1 })
      .where(eq(loans.id, loan.id));
    await this.audit.log({
      action: "loan.renewed",
      entityType: "loan",
      entityId: loan.id,
      actorUserId: actorId,
      metadata: { newDueAt: newDueAt.toISOString(), renewedCount: loan.renewedCount + 1 },
    });
    return this.detail(loan.id);
  }

  async markLost(loanId: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const rows = await db
      .select()
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.tenantId, tenantId)))
      .limit(1);
    const loan = rows[0];
    if (!loan) throw notFound("loan_not_found", "Loan not found");
    if (loan.status === "returned") throw conflict("already_returned", "This loan is already closed");

    const policy = await this.policy();
    const now = new Date();
    await db
      .update(loans)
      .set({ status: "returned", returnedAt: now, checkedInBy: actorId })
      .where(eq(loans.id, loan.id));
    await db.update(copies).set({ status: "lost" }).where(eq(copies.id, loan.copyId));
    const [fine] = await db
      .insert(fines)
      .values({
        tenantId,
        memberId: loan.memberId,
        loanId: loan.id,
        type: "lost",
        amountCents: policy.lostItemFeeCents,
        createdBy: actorId,
        note: "Item reported lost",
      })
      .returning({ id: fines.id });
    await this.audit.log({
      action: "loan.marked_lost",
      entityType: "loan",
      entityId: loan.id,
      actorUserId: actorId,
      metadata: { fineCents: policy.lostItemFeeCents },
    });
    return { loanId: loan.id, fineId: fine.id, fineCents: policy.lostItemFeeCents };
  }

  async list(query: ListLoansQuery) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const params = pageParams(query);
    const filters = [eq(loans.tenantId, tenantId)];
    if (query.status) filters.push(eq(loans.status, query.status));
    if (query.memberId) filters.push(eq(loans.memberId, query.memberId));
    if (query.bookId) filters.push(eq(loans.bookId, query.bookId));
    if (query.overdue) {
      filters.push(
        dsql`(${loans.status} = 'overdue' or (${loans.status} = 'active' and ${loans.dueAt} < now()))`,
      );
    }
    if (query.q) {
      filters.push(
        or(ilike(members.fullName, `%${query.q}%`), ilike(books.title, `%${query.q}%`))!,
      );
    }
    const where = and(...filters);

    const baseQuery = db
      .select({
        id: loans.id,
        status: loans.status,
        checkedOutAt: loans.checkedOutAt,
        dueAt: loans.dueAt,
        returnedAt: loans.returnedAt,
        renewedCount: loans.renewedCount,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
        bookId: books.id,
        bookTitle: books.title,
        copyId: copies.id,
        copyBarcode: copies.barcode,
      })
      .from(loans)
      .innerJoin(members, eq(loans.memberId, members.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(copies, eq(loans.copyId, copies.id))
      .where(where);

    const items = await baseQuery
      .orderBy(query.overdue ? asc(loans.dueAt) : desc(loans.checkedOutAt))
      .limit(params.perPage)
      .offset(params.offset);

    const countQuery = db
      .select({ total: dsql<number>`count(*)::int` })
      .from(loans)
      .innerJoin(members, eq(loans.memberId, members.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .where(where);
    const countRows = await countQuery;
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async overdueSummary() {
    const db = getDb();
    const { tenantId } = this.ctx();
    const now = new Date();
    const rows = await db
      .select({
        loanId: loans.id,
        dueAt: loans.dueAt,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
        memberEmail: members.email,
        bookTitle: books.title,
        copyBarcode: copies.barcode,
      })
      .from(loans)
      .innerJoin(members, eq(loans.memberId, members.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(copies, eq(loans.copyId, copies.id))
      .where(
        and(
          eq(loans.tenantId, tenantId),
          dsql`(${loans.status} = 'overdue' or (${loans.status} = 'active' and ${loans.dueAt} < now()))`,
        ),
      )
      .orderBy(asc(loans.dueAt))
      .limit(500);
    return rows.map((row) => ({ ...row, overdueDays: overdueDays(row.dueAt, now) }));
  }

  async detail(loanId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({
        id: loans.id,
        status: loans.status,
        checkedOutAt: loans.checkedOutAt,
        dueAt: loans.dueAt,
        returnedAt: loans.returnedAt,
        renewedCount: loans.renewedCount,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
        bookId: books.id,
        bookTitle: books.title,
        bookAuthors: books.authors,
        copyId: copies.id,
        copyBarcode: copies.barcode,
      })
      .from(loans)
      .innerJoin(members, eq(loans.memberId, members.id))
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(copies, eq(loans.copyId, copies.id))
      .where(and(eq(loans.id, loanId), eq(loans.tenantId, tenantId)))
      .limit(1);
    const loan = rows[0];
    if (!loan) throw notFound("loan_not_found", "Loan not found");
    return loan;
  }

  async activeForMember(memberId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    return db
      .select({
        id: loans.id,
        status: loans.status,
        checkedOutAt: loans.checkedOutAt,
        dueAt: loans.dueAt,
        renewedCount: loans.renewedCount,
        bookId: books.id,
        bookTitle: books.title,
        bookAuthors: books.authors,
        coverUrl: books.coverUrl,
        copyBarcode: copies.barcode,
      })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(copies, eq(loans.copyId, copies.id))
      .where(and(eq(loans.memberId, memberId), dsql`${loans.status} in ('active','overdue')`))
      .orderBy(asc(loans.dueAt));
  }

  async historyForMember(memberId: string, limit = 50) {
    const db = getDb();
    const { tenantId } = this.ctx();
    return db
      .select({
        id: loans.id,
        status: loans.status,
        checkedOutAt: loans.checkedOutAt,
        dueAt: loans.dueAt,
        returnedAt: loans.returnedAt,
        bookTitle: books.title,
        bookId: books.id,
      })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .where(and(eq(loans.memberId, memberId), eq(loans.tenantId, tenantId)))
      .orderBy(desc(loans.checkedOutAt))
      .limit(Math.min(200, Math.max(1, limit)));
  }

  async statusOfCopy(copyId: string): Promise<LoanStatus | "none"> {
    const db = getDb();
    const rows = await db
      .select({ status: loans.status })
      .from(loans)
      .where(and(eq(loans.copyId, copyId), dsql`${loans.status} in ('active','overdue')`))
      .limit(1);
    return rows[0]?.status ?? "none";
  }
}
