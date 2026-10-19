import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, or, sql as dsql } from "drizzle-orm";
import { books, branches, copies, holds, members, tenants } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams } from "../../common/pagination";
import { parseTenantSettings } from "../tenants/tenant-settings";
import { NotificationsService } from "../notifications/notifications.service";
import type { ListHoldsQuery, PlaceHoldInput } from "./dto";

@Injectable()
export class HoldsService {
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
    const { tenantId } = this.ctx();
    const rows = await getDb()
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return parseTenantSettings(rows[0]?.settings).circulation;
  }

  async place(input: PlaceHoldInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const policy = await this.policy();
    if (!policy.holdsEnabled) {
      throw conflict("holds_disabled", "Holds are disabled for this library");
    }

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
    if (member.status === "closed" || member.status === "expired") {
      throw conflict("member_inactive", "This membership cannot place holds");
    }

    const bookRows = await db
      .select()
      .from(books)
      .where(and(eq(books.id, input.bookId), eq(books.tenantId, tenantId)))
      .limit(1);
    const book = bookRows[0];
    if (!book) throw notFound("book_not_found", "Book not found");
    if (book.status !== "active") {
      throw conflict("book_archived", "This title is not available for holds");
    }

    const existing = await db
      .select({ id: holds.id })
      .from(holds)
      .where(
        and(
          eq(holds.bookId, book.id),
          eq(holds.memberId, member.id),
          dsql`${holds.status} in ('pending','ready')`,
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw conflict("hold_exists", "This member already has an open hold for this title");
    }

    const [hold] = await db
      .insert(holds)
      .values({
        tenantId,
        bookId: book.id,
        memberId: member.id,
        branchId: input.branchId ?? null,
      })
      .returning();

    await this.audit.log({
      action: "hold.placed",
      entityType: "hold",
      entityId: hold.id,
      actorUserId: actorId,
      metadata: { bookId: book.id, memberId: member.id },
    });

    await this.allocateForBook(book.id);
    const rows = await this.getOne(hold.id);
    return rows;
  }

  async cancel(holdId: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const rows = await db
      .select()
      .from(holds)
      .where(and(eq(holds.id, holdId), eq(holds.tenantId, tenantId)))
      .limit(1);
    const hold = rows[0];
    if (!hold) throw notFound("hold_not_found", "Hold not found");
    if (hold.status !== "pending" && hold.status !== "ready") {
      throw conflict("hold_not_open", `This hold is already ${hold.status}`);
    }

    await db.update(holds).set({ status: "cancelled" }).where(eq(holds.id, hold.id));
    if (hold.status === "ready") {
      await this.releaseReservedCopy(hold.bookId);
    }
    await this.audit.log({
      action: "hold.cancelled",
      entityType: "hold",
      entityId: hold.id,
      actorUserId: actorId,
      metadata: { bookId: hold.bookId, memberId: hold.memberId },
    });
    await this.allocateForBook(hold.bookId);
    return this.getOne(hold.id);
  }

  async expireStaleHolds(): Promise<number> {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const stale = await db
      .select({ id: holds.id, bookId: holds.bookId })
      .from(holds)
      .where(and(eq(holds.status, "ready"), dsql`${holds.expiresAt} < now()`));
    for (const hold of stale) {
      await db.update(holds).set({ status: "expired" }).where(eq(holds.id, hold.id));
      await this.releaseReservedCopy(hold.bookId);
      await this.audit.log({
        action: "hold.expired",
        entityType: "hold",
        entityId: hold.id,
        actorUserId: actorId,
        metadata: { bookId: hold.bookId },
      });
      await this.allocateForBook(hold.bookId);
    }
    return stale.length;
  }

  private async releaseReservedCopy(bookId: string): Promise<void> {
    await getDb()
      .update(copies)
      .set({ status: "available" })
      .where(and(eq(copies.bookId, bookId), eq(copies.status, "reserved")));
  }

  private async allocateForBook(bookId: string): Promise<void> {
    const db = getDb();
    const policy = await this.policy();
    const nextRows = await db
      .select()
      .from(holds)
      .where(and(eq(holds.bookId, bookId), eq(holds.status, "pending")))
      .orderBy(asc(holds.placedAt))
      .limit(1);
    const nextHold = nextRows[0];
    if (!nextHold) return;

    const copyRows = await db
      .select()
      .from(copies)
      .where(and(eq(copies.bookId, bookId), eq(copies.status, "available")))
      .limit(1);
    const copy = copyRows[0];
    if (!copy) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + policy.holdShelfExpiryDays * 24 * 60 * 60 * 1000);
    await db.update(copies).set({ status: "reserved" }).where(eq(copies.id, copy.id));
    await db
      .update(holds)
      .set({ status: "ready", readyAt: now, expiresAt })
      .where(eq(holds.id, nextHold.id));

    const [member] = await db.select().from(members).where(eq(members.id, nextHold.memberId)).limit(1);
    const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (member && book) {
      await this.notifications.sendHoldReady({
        member,
        bookTitle: book.title,
        expiresAt,
      });
    }
  }

  async list(query: ListHoldsQuery) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const params = pageParams(query);
    const filters = [eq(holds.tenantId, tenantId)];
    if (query.status) filters.push(eq(holds.status, query.status));
    if (query.memberId) filters.push(eq(holds.memberId, query.memberId));
    if (query.bookId) filters.push(eq(holds.bookId, query.bookId));
    if (query.q) {
      filters.push(or(ilike(members.fullName, `%${query.q}%`), ilike(books.title, `%${query.q}%`))!);
    }
    const where = and(...filters);

    const items = await db
      .select({
        id: holds.id,
        status: holds.status,
        placedAt: holds.placedAt,
        readyAt: holds.readyAt,
        expiresAt: holds.expiresAt,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
        memberEmail: members.email,
        bookId: books.id,
        bookTitle: books.title,
        bookAuthors: books.authors,
        branchId: holds.branchId,
        branchName: branches.name,
      })
      .from(holds)
      .innerJoin(members, eq(holds.memberId, members.id))
      .innerJoin(books, eq(holds.bookId, books.id))
      .leftJoin(branches, eq(holds.branchId, branches.id))
      .where(where)
      .orderBy(
        query.status === "pending" || query.status === "ready"
          ? asc(holds.placedAt)
          : desc(holds.placedAt),
      )
      .limit(params.perPage)
      .offset(params.offset);

    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(holds)
      .innerJoin(members, eq(holds.memberId, members.id))
      .innerJoin(books, eq(holds.bookId, books.id))
      .where(where);
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async getOne(holdId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({
        id: holds.id,
        status: holds.status,
        placedAt: holds.placedAt,
        readyAt: holds.readyAt,
        expiresAt: holds.expiresAt,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
        memberEmail: members.email,
        bookId: books.id,
        bookTitle: books.title,
        bookAuthors: books.authors,
      })
      .from(holds)
      .innerJoin(members, eq(holds.memberId, members.id))
      .innerJoin(books, eq(holds.bookId, books.id))
      .where(and(eq(holds.id, holdId), eq(holds.tenantId, tenantId)))
      .limit(1);
    const hold = rows[0];
    if (!hold) throw notFound("hold_not_found", "Hold not found");
    return hold;
  }

  async openForMember(memberId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    return db
      .select({
        id: holds.id,
        status: holds.status,
        placedAt: holds.placedAt,
        expiresAt: holds.expiresAt,
        bookId: books.id,
        bookTitle: books.title,
        bookAuthors: books.authors,
        coverUrl: books.coverUrl,
      })
      .from(holds)
      .innerJoin(books, eq(holds.bookId, books.id))
      .where(
        and(
          eq(holds.memberId, memberId),
          eq(holds.tenantId, tenantId),
          dsql`${holds.status} in ('pending','ready')`,
        ),
      )
      .orderBy(asc(holds.placedAt));
  }
}
