import { Injectable } from "@nestjs/common";
import { auditLogs } from "../db/schema";
import { getDb, requestDb, withSavepoint } from "../db/client";
import type { Db } from "../db/client";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  actorUserId?: string | null;
  tenantId?: string | null;
}

@Injectable()
export class AuditService {
  async log(entry: AuditEntry): Promise<void> {
    const store = requestDb.getStore();
    try {
      await withSavepoint((db: Db) =>
        db
          .insert(auditLogs)
          .values({
            tenantId: entry.tenantId !== undefined ? entry.tenantId : (store?.tenantId ?? null),
            actorUserId:
              entry.actorUserId !== undefined ? entry.actorUserId : (store?.userId ?? null),
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId ?? null,
            metadata: entry.metadata ?? {},
            ip: entry.ip ?? null,
          })
          .then(() => undefined),
      );
    } catch {
      // audit failures must never break the request path
    }
  }
}
