import { Injectable } from "@nestjs/common";
import { and, eq, sql as dsql } from "drizzle-orm";
import { holds, loans, members } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { LoansService } from "../loans/loans.service";
import { HoldsService } from "../holds/holds.service";
import { FinesService } from "../fines/fines.service";
import type { UpdateProfileInput } from "./dto";

@Injectable()
export class MeService {
  constructor(
    private readonly audit: AuditService,
    private readonly loans: LoansService,
    private readonly holds: HoldsService,
    private readonly fines: FinesService,
  ) {}

  private async resolveMember() {
    const store = requestDb.getStore();
    if (!store?.tenantId || !store.userId) {
      throw forbidden("no_membership", "This account has no library membership context");
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, store.userId), eq(members.tenantId, store.tenantId)))
      .limit(1);
    const member = rows[0];
    if (!member) {
      throw notFound("member_not_found", "No library membership is linked to this account");
    }
    return member;
  }

  async profile() {
    const member = await this.resolveMember();
    const db = getDb();
    const [loanStats] = await db
      .select({
        activeLoans: dsql<number>`count(*) filter (where ${loans.status} in ('active','overdue'))::int`,
      })
      .from(loans)
      .where(eq(loans.memberId, member.id));
    const [holdStats] = await db
      .select({ openHolds: dsql<number>`count(*)::int` })
      .from(holds)
      .where(and(eq(holds.memberId, member.id), dsql`${holds.status} in ('pending','ready')`));
    const outstandingCents = await this.fines.outstandingTotalForMember(member.id);
    return {
      member: {
        id: member.id,
        cardNumber: member.cardNumber,
        fullName: member.fullName,
        email: member.email,
        phone: member.phone,
        category: member.category,
        status: member.status,
        joinedAt: member.joinedAt,
        expiresAt: member.expiresAt,
      },
      stats: {
        activeLoans: loanStats?.activeLoans ?? 0,
        openHolds: holdStats?.openHolds ?? 0,
        outstandingCents,
      },
    };
  }

  async updateProfile(input: UpdateProfileInput) {
    const member = await this.resolveMember();
    const db = getDb();
    const patch: Partial<{ email: string | null; phone: string | null }> = {};
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (Object.keys(patch).length > 0) {
      await db.update(members).set(patch).where(eq(members.id, member.id));
      await this.audit.log({
        action: "member.self_updated",
        entityType: "member",
        entityId: member.id,
        metadata: { fields: Object.keys(patch) },
      });
    }
    return this.profile();
  }

  async activeLoans() {
    const member = await this.resolveMember();
    return this.loans.activeForMember(member.id);
  }

  async loanHistory() {
    const member = await this.resolveMember();
    return this.loans.historyForMember(member.id);
  }

  async renewLoan(loanId: string) {
    const member = await this.resolveMember();
    const loan = await this.loans.detail(loanId);
    if (loan.memberId !== member.id) {
      throw forbidden("not_your_loan", "This loan does not belong to you");
    }
    return this.loans.renew(loanId);
  }

  async openHolds() {
    const member = await this.resolveMember();
    return this.holds.openForMember(member.id);
  }

  async placeHold(bookId: string) {
    const member = await this.resolveMember();
    return this.holds.place({ bookId, memberId: member.id });
  }

  async cancelHold(holdId: string) {
    const member = await this.resolveMember();
    const hold = await this.holds.getOne(holdId);
    if (hold.memberId !== member.id) {
      throw forbidden("not_your_hold", "This hold does not belong to you");
    }
    return this.holds.cancel(holdId);
  }

  async myFines() {
    const member = await this.resolveMember();
    const items = await this.fines.listForMember(member.id);
    const outstandingCents = await this.fines.outstandingTotalForMember(member.id);
    return { items, outstandingCents };
  }
}
