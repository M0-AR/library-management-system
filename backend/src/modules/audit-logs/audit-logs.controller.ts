import { Controller, Get, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { AuditLogsService } from "./audit-logs.service";
import { listAuditLogsSchema, type ListAuditLogsQuery } from "./dto";

@Controller("audit-logs")
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Roles("tenant_admin")
  @Get()
  list(@Query(new ZodPipe(listAuditLogsSchema)) query: ListAuditLogsQuery) {
    return this.auditLogs.list(query);
  }
}
