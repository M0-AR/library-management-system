import { Injectable } from "@nestjs/common";
import { and, asc, eq, ilike, inArray, or, sql as dsql } from "drizzle-orm";
import { branches, members, refreshTokens, users } from "../../db/schema";
import type { UserRole } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { pgErrorCode } from "../../db/pg-errors";
import { badRequest, conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { pageMeta, pageParams } from "../../common/pagination";
import { hashPassword } from "../auth/password";
import type { CreateUserInput, UpdateUserInput } from "./dto";

const STAFF_ROLES: UserRole[] = ["tenant_admin", "librarian", "assistant"];

const publicColumns = {
  id: users.id,
  tenantId: users.tenantId,
  email: users.email,
  name: users.name,
  role: users.role,
  branchId: users.branchId,
  status: users.status,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

@Injectable()
export class UsersService {
  constructor(private readonly audit: AuditService) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId, actorId: store.userId ?? null };
  }

  async list(query: { q?: string; role?: UserRole; status?: "active" | "disabled"; page?: number; perPage?: number }) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const params = pageParams(query);
    const filters = [eq(users.tenantId, tenantId), inArray(users.role, STAFF_ROLES)];
    if (query.role) filters.push(eq(users.role, query.role));
    if (query.status) filters.push(eq(users.status, query.status));
    if (query.q) {
      filters.push(or(ilike(users.name, `%${query.q}%`), ilike(users.email, `%${query.q}%`))!);
    }
    const where = and(...filters);
    const items = await db
      .select(publicColumns)
      .from(users)
      .where(where)
      .orderBy(asc(users.name))
      .limit(params.perPage)
      .offset(params.offset);
    const countRows = await db.select({ total: dsql<number>`count(*)::int` }).from(users).where(where);
    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }

  async get(userId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select(publicColumns)
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    const user = rows[0];
    if (!user) throw notFound("user_not_found", "User not found");
    return user;
  }

  async create(input: CreateUserInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    if (input.branchId) {
      const branch = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      if (branch.length === 0) throw badRequest("branch_not_found", "Branch not found");
    }
    if (input.role === "patron" && input.memberId) {
      const memberRows = await db
        .select({ id: members.id, userId: members.userId })
        .from(members)
        .where(and(eq(members.id, input.memberId), eq(members.tenantId, tenantId)))
        .limit(1);
      const member = memberRows[0];
      if (!member) throw badRequest("member_not_found", "Member not found");
      if (member.userId) {
        throw conflict("member_already_linked", "That member already has a portal account");
      }
    }
    const passwordHash = await hashPassword(input.password);
    try {
      const [row] = await db
        .insert(users)
        .values({
          tenantId,
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
          role: input.role,
          branchId: input.branchId ?? null,
        })
        .returning(publicColumns);
      if (input.role === "patron" && input.memberId) {
        await db.update(members).set({ userId: row.id }).where(eq(members.id, input.memberId));
      }
      await this.audit.log({
        action: "user.created",
        entityType: "user",
        entityId: row.id,
        actorUserId: actorId,
        metadata: { role: input.role, email: row.email },
      });
      return row;
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("email_taken", "A user with that email already exists");
      }
      throw err;
    }
  }

  async update(userId: string, input: UpdateUserInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    if (existing.length === 0) throw notFound("user_not_found", "User not found");
    if (existing[0].role === "platform_admin") throw forbidden();
    if (Object.values(input).every((value) => value === undefined)) {
      throw badRequest("no_changes", "Provide at least one field to update");
    }

    if (input.branchId) {
      const branch = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      if (branch.length === 0) throw badRequest("branch_not_found", "Branch not found");
    }

    const [row] = await db
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .where(eq(users.id, userId))
      .returning(publicColumns);

    if (input.status === "disabled") {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), dsql`${refreshTokens.revokedAt} is null`));
    }
    await this.audit.log({
      action: "user.updated",
      entityType: "user",
      entityId: userId,
      actorUserId: actorId,
      metadata: { changes: Object.keys(input) },
    });
    return row;
  }

  async resetPassword(userId: string, newPassword: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    if (existing.length === 0) throw notFound("user_not_found", "User not found");
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), dsql`${refreshTokens.revokedAt} is null`));
    await this.audit.log({
      action: "user.password_reset",
      entityType: "user",
      entityId: userId,
      actorUserId: actorId,
    });
  }

  async disable(userId: string) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    if (userId === actorId) throw badRequest("self_disable", "You cannot disable your own account");
    const rows = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    if (rows.length === 0) throw notFound("user_not_found", "User not found");
    if (rows[0].role === "platform_admin") throw forbidden();
    await db.update(users).set({ status: "disabled" }).where(eq(users.id, userId));
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), dsql`${refreshTokens.revokedAt} is null`));
    await this.audit.log({
      action: "user.disabled",
      entityType: "user",
      entityId: userId,
      actorUserId: actorId,
    });
  }
}
