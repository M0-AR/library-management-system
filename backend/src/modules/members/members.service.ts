import { Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, or, sql as dsql } from "drizzle-orm";
import { fines, holds, loans, members } from "../../db/schema";
import type { MemberCategory, MemberStatus } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { pgErrorCode } from "../../db/pg-errors";
import { badRequest, conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams } from "../../common/pagination";
import type { CreateMemberInput, UpdateMemberInput } from "./dto";

const memberColumns = {
  id: members.id,
  cardNumber: members.cardNumber,
  fullName: members.fullName,
  email: members.email,
  phone: members.phone,
  category: members.category,
  status: members.status,
  joinedAt: members.joinedAt,
  expiresAt: members.expiresAt,
  notes: members.notes,
  userId: members.userId,
  createdAt: members.createdAt,
  updatedAt: members.updatedAt,
};

@Injectable()
export class MembersService {
  constructor(private readonly audit: AuditService) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId, actorId: store.userId ?? null };
  }

  async list(query: {
    q?: string;
    status?: MemberStatus;
    category?: MemberCategory;
    page?: number;
    perPage?: number;
  }) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const params = pageParams(query);
    const filters = [eq(members.tenantId, tenantId)];
    if (query.status) filters.push(eq(members.status, query.status));
    if (query.category) filters.push(eq(members.category, query.category));
    if (query.q) {
      filters.push(
        or(
          ilike(members.fullName, `%${query.q}%`),
          ilike(members.cardNumber, `%${query.q}%`),
          ilike(members.email, `%${query.q}%`),
        )!,
      );
    }
    const where = and(...filters);
    const items = await db
      .select({
        ...memberColumns,
        activeLoans: dsql<number>`(select count(*)::int from loans where loans.member_id = members.id and loans.status in ('active','overdue'))`,
        overdueLoans: dsql<number>`(select count(*)::int from loans where loans.member_id = members.id and loans.status = 'overdue')`,
        openHolds: dsql<number>`(select count(*)::int from holds where holds.member_id = members.id and holds.status in ('pending','ready'))`,
      })
      .from(members)
      .where(where)
      .orderBy(asc(members.fullName))
      .limit(params.perPage)
      .offset(params.offset);
    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(members)
      .where(where);
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async get(memberId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({
        ...memberColumns,
        activeLoans: dsql<number>`(select count(*)::int from loans where loans.member_id = members.id and loans.status in ('active','overdue'))`,
        overdueLoans: dsql<number>`(select count(*)::int from loans where loans.member_id = members.id and loans.status = 'overdue')`,
        openHolds: dsql<number>`(select count(*)::int from holds where holds.member_id = members.id and holds.status in ('pending','ready'))`,
        outstandingFineCents: dsql<number>`(select coalesce(sum(${fines.amountCents}),0)::int from fines where fines.member_id = members.id and fines.status = 'outstanding')`,
      })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.tenantId, tenantId)))
      .limit(1);
    const member = rows[0];
    if (!member) throw notFound("member_not_found", "Member not found");
    return member;
  }

  async findByCard(cardNumber: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select(memberColumns)
      .from(members)
      .where(and(eq(members.tenantId, tenantId), eq(members.cardNumber, cardNumber)))
      .limit(1);
    const member = rows[0];
    if (!member) throw notFound("member_not_found", "Member not found");
    return member;
  }

  async create(input: CreateMemberInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const maxAttempts = input.cardNumber ? 1 : 6;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const cardNumber =
        input.cardNumber ?? `M${String(randomInt(1, 999999)).padStart(6, "0")}`;
      try {
        const [row] = await db
          .insert(members)
          .values({
            tenantId,
            cardNumber,
            fullName: input.fullName,
            email: input.email ?? null,
            phone: input.phone ?? null,
            category: input.category,
            expiresAt: input.expiresAt ?? null,
            notes: input.notes ?? null,
          })
          .returning(memberColumns);
        await this.audit.log({
          action: "member.created",
          entityType: "member",
          entityId: row.id,
          actorUserId: actorId,
          metadata: { cardNumber: row.cardNumber },
        });
        return row;
      } catch (err) {
        if (pgErrorCode(err) === "23505") {
          if (input.cardNumber) {
            throw conflict("card_taken", "That card number is already in use");
          }
          continue;
        }
        throw err;
      }
    }
    throw conflict("card_generation_failed", "Could not allocate a card number, please try again");
  }

  async update(memberId: string, input: UpdateMemberInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    if (Object.values(input).every((value) => value === undefined)) {
      throw badRequest("no_changes", "Provide at least one field to update");
    }
    const [row] = await db
      .update(members)
      .set({
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .where(and(eq(members.id, memberId), eq(members.tenantId, tenantId)))
      .returning(memberColumns);
    if (!row) throw notFound("member_not_found", "Member not found");
    await this.audit.log({
      action: "member.updated",
      entityType: "member",
      entityId: memberId,
      actorUserId: actorId,
      metadata: { fields: Object.keys(input) },
    });
    return row;
  }

  async close(memberId: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const open = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(loans)
      .where(
        and(
          eq(loans.memberId, memberId),
          dsql`${loans.status} in ('active','overdue')`,
        ),
      );
    if ((open[0]?.total ?? 0) > 0) {
      throw conflict("open_loans", "This member still has books checked out");
    }
    const [row] = await db
      .update(members)
      .set({ status: "closed" })
      .where(and(eq(members.id, memberId), eq(members.tenantId, tenantId)))
      .returning(memberColumns);
    if (!row) throw notFound("member_not_found", "Member not found");
    await this.audit.log({
      action: "member.closed",
      entityType: "member",
      entityId: memberId,
      actorUserId: actorId,
    });
    return row;
  }

  async stats() {
    const db = getDb();
    const { tenantId } = this.ctx();
    const [row] = await db
      .select({
        total: dsql<number>`count(*)::int`,
        active: dsql<number>`count(*) filter (where ${members.status} = 'active')::int`,
        suspended: dsql<number>`count(*) filter (where ${members.status} = 'suspended')::int`,
      })
      .from(members)
      .where(eq(members.tenantId, tenantId));
    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [newThisWeek] = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(members)
      .where(and(eq(members.tenantId, tenantId), gte(members.createdAt, sinceWeek)));
    return { ...row, newThisWeek: newThisWeek?.total ?? 0 };
  }
}
