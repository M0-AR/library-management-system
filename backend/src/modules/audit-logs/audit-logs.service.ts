import { Injectable } from "@nestjs/common";
import { and, desc, eq, sql as dsql } from "drizzle-orm";
import { auditLogs, users } from "../../db/schema";
import { getDb, requestDb } from "../../db/client";
import { forbidden } from "../../common/errors";
import { pageMeta, pageParams } from "../../common/pagination";
import type { ListAuditLogsQuery } from "./dto";

@Injectable()
export class AuditLogsService {
  async list(query: ListAuditLogsQuery) {
    const store = requestDb.getStore();
    if (!store?.tenantId) throw forbidden("no_tenant", "No tenant context for this request");
    const db = getDb();
    const params = pageParams(query);
    const filters = [eq(auditLogs.tenantId, store.tenantId)];
    if (query.action) filters.push(eq(auditLogs.action, query.action));
    if (query.entityType) filters.push(eq(auditLogs.entityType, query.entityType));
    const where = and(...filters);

    const items = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.perPage)
      .offset(params.offset);

    const countRows = await db
      .select({ total: dsql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where);

    return { items, meta: pageMeta(params, countRows[0]?.total ?? 0) };
  }
}
