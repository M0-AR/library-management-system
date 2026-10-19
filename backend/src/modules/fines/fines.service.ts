import { Injectable } from "@nestjs/common";
import { and, desc, eq, ilike, or, sql as dsql } from "drizzle-orm";
import { fines, members, tenants } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams } from "../../common/pagination";
import { parseTenantSettings } from "../tenants/tenant-settings";
import type { CreateFineInput, FineActionInput, ListFinesQuery } from "./dto";

@Injectable()
export class FinesService {
  constructor(private readonly audit: AuditService) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId, actorId: store.userId ?? null };
  }

  async list(query: ListFinesQuery) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const params = pageParams(query);
    const filters = [eq(fines.tenantId, tenantId)];
    if (query.status) filters.push(eq(fines.status, query.status));
    if (query.type) filters.push(eq(fines.type, query.type));
    if (query.memberId) filters.push(eq(fines.memberId, query.memberId));
    if (query.q) {
      filters.push(or(ilike(members.fullName, `%${query.q}%`), ilike(members.cardNumber, `%${query.q}%`))!);
    }
    const where = and(...filters);

    const items = await db
      .select({
        id: fines.id,
        type: fines.type,
        amountCents: fines.amountCents,
        currency: fines.currency,
        status: fines.status,
        note: fines.note,
        createdAt: fines.createdAt,
        paidAt: fines.paidAt,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
        memberEmail: members.email,
      })
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .where(where)
      .orderBy(desc(fines.createdAt))
      .limit(params.perPage)
      .offset(params.offset);

    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .where(where);
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async summary() {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({
        outstandingCents: dsql<number>`coalesce(sum(case when ${fines.status} = 'outstanding' then ${fines.amountCents} else 0 end),0)::int`,
        outstandingCount: dsql<number>`count(*) filter (where ${fines.status} = 'outstanding')::int`,
        collectedCents: dsql<number>`coalesce(sum(case when ${fines.status} = 'paid' then ${fines.amountCents} else 0 end),0)::int`,
        waivedCents: dsql<number>`coalesce(sum(case when ${fines.status} = 'waived' then ${fines.amountCents} else 0 end),0)::int`,
        collectedLast30: dsql<number>`coalesce(sum(case when ${fines.status} = 'paid' and ${fines.paidAt} > now() - interval '30 days' then ${fines.amountCents} else 0 end),0)::int`,
      })
      .from(fines)
      .where(eq(fines.tenantId, tenantId));
    return rows[0];
  }

  async getOne(fineId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({
        id: fines.id,
        type: fines.type,
        amountCents: fines.amountCents,
        currency: fines.currency,
        status: fines.status,
        note: fines.note,
        loanId: fines.loanId,
        createdAt: fines.createdAt,
        paidAt: fines.paidAt,
        memberId: members.id,
        memberName: members.fullName,
        memberCard: members.cardNumber,
      })
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .where(and(eq(fines.id, fineId), eq(fines.tenantId, tenantId)))
      .limit(1);
    const fine = rows[0];
    if (!fine) throw notFound("fine_not_found", "Fine not found");
    return fine;
  }

  async create(input: CreateFineInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
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

    const settings = await this.settings();
    const [fine] = await db
      .insert(fines)
      .values({
        tenantId,
        memberId: member.id,
        type: input.type,
        amountCents: input.amountCents,
        currency: settings.currency,
        note: input.note ?? null,
        createdBy: actorId,
      })
      .returning({ id: fines.id });

    await this.audit.log({
      action: "fine.created",
      entityType: "fine",
      entityId: fine.id,
      actorUserId: actorId,
      metadata: { memberId: member.id, amountCents: input.amountCents, type: input.type },
    });
    return this.getOne(fine.id);
  }

  async pay(fineId: string, input: FineActionInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const fine = await this.openFine(fineId);
    await db
      .update(fines)
      .set({
        status: "paid",
        paidAt: new Date(),
        note: input.note ? `${fine.note ? `${fine.note} · ` : ""}${input.note}` : fine.note,
      })
      .where(and(eq(fines.id, fineId), eq(fines.tenantId, tenantId)));
    await this.audit.log({
      action: "fine.paid",
      entityType: "fine",
      entityId: fineId,
      actorUserId: actorId,
      metadata: { amountCents: fine.amountCents, memberId: fine.memberId },
    });
    return this.getOne(fineId);
  }

  async waive(fineId: string, input: FineActionInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const fine = await this.openFine(fineId);
    await db
      .update(fines)
      .set({
        status: "waived",
        note: input.note ? `${fine.note ? `${fine.note} · ` : ""}${input.note}` : fine.note,
      })
      .where(and(eq(fines.id, fineId), eq(fines.tenantId, tenantId)));
    await this.audit.log({
      action: "fine.waived",
      entityType: "fine",
      entityId: fineId,
      actorUserId: actorId,
      metadata: { amountCents: fine.amountCents, memberId: fine.memberId },
    });
    return this.getOne(fineId);
  }

  async listForMember(memberId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    return db
      .select()
      .from(fines)
      .where(and(eq(fines.memberId, memberId), eq(fines.tenantId, tenantId)))
      .orderBy(desc(fines.createdAt))
      .limit(100);
  }

  async outstandingTotalForMember(memberId: string): Promise<number> {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select({ total: dsql<number>`coalesce(sum(${fines.amountCents}),0)::int` })
      .from(fines)
      .where(and(eq(fines.memberId, memberId), eq(fines.tenantId, tenantId), eq(fines.status, "outstanding")));
    return rows[0]?.total ?? 0;
  }

  private async openFine(fineId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select()
      .from(fines)
      .where(and(eq(fines.id, fineId), eq(fines.tenantId, tenantId)))
      .limit(1);
    const fine = rows[0];
    if (!fine) throw notFound("fine_not_found", "Fine not found");
    if (fine.status !== "outstanding") {
      throw conflict("fine_not_open", `This fine is already ${fine.status}`);
    }
    return fine;
  }

  private async settings() {
    const { tenantId } = this.ctx();
    const rows = await getDb()
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return parseTenantSettings(rows[0]?.settings);
  }
}
