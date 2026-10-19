import { Injectable } from "@nestjs/common";
import { and, asc, eq, ilike } from "drizzle-orm";
import { branches } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { pgErrorCode } from "../../db/pg-errors";
import { badRequest, conflict, forbidden, notFound } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,12}$/, "Code must be 2-12 uppercase letters, numbers or hyphens"),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

@Injectable()
export class BranchesService {
  constructor(private readonly audit: AuditService) {}

  private ctx() {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    return { tenantId: store.tenantId, actorId: store.userId ?? null };
  }

  async list(includeInactive = false) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const filters = [eq(branches.tenantId, tenantId)];
    if (!includeInactive) filters.push(eq(branches.status, "active"));
    return db
      .select()
      .from(branches)
      .where(and(...filters))
      .orderBy(asc(branches.name));
  }

  async get(branchId: string) {
    const db = getDb();
    const { tenantId } = this.ctx();
    const rows = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
      .limit(1);
    if (rows.length === 0) throw notFound("branch_not_found", "Branch not found");
    return rows[0];
  }

  async create(input: CreateBranchInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    try {
      const [row] = await db
        .insert(branches)
        .values({
          tenantId,
          name: input.name,
          code: input.code,
          address: input.address ?? null,
          phone: input.phone ?? null,
        })
        .returning();
      await this.audit.log({
        action: "branch.created",
        entityType: "branch",
        entityId: row.id,
        actorUserId: actorId,
        metadata: { code: row.code },
      });
      return row;
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        throw conflict("branch_code_taken", "A branch with that code already exists");
      }
      throw err;
    }
  }

  async update(branchId: string, input: UpdateBranchInput) {
    const db = getDb();
    const { tenantId, actorId } = this.ctx();
    if (Object.values(input).every((value) => value === undefined)) {
      throw badRequest("no_changes", "Provide at least one field to update");
    }
    const [row] = await db
      .update(branches)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
      .returning();
    if (!row) throw notFound("branch_not_found", "Branch not found");
    await this.audit.log({
      action: "branch.updated",
      entityType: "branch",
      entityId: branchId,
      actorUserId: actorId,
      metadata: { fields: Object.keys(input) },
    });
    return row;
  }
}
