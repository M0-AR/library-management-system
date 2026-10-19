import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../../common/decorators";
import { NotificationsService } from "./notifications.service";
import type { ListNotificationsQuery } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Roles("tenant_admin", "librarian")
  @Get()
  list(@Query() query: ListNotificationsQuery) {
    return this.notifications.list({
      status: query.status,
      page: query.page ? Number(query.page) : undefined,
      perPage: query.perPage ? Number(query.perPage) : undefined,
    });
  }
}
