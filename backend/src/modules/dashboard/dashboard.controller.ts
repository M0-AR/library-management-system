import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../../common/decorators";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("summary")
  summary() {
    return this.dashboard.summary();
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("circulation")
  circulation(@Query("days") days?: string) {
    return this.dashboard.circulationSeries(days ? Number(days) : 30);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("top-titles")
  topTitles(@Query("days") days?: string, @Query("limit") limit?: string) {
    return this.dashboard.topTitles(days ? Number(days) : 30, limit ? Number(limit) : 5);
  }

  @Roles("tenant_admin", "librarian", "assistant")
  @Get("recent-checkouts")
  recent(@Query("limit") limit?: string) {
    return this.dashboard.recentCheckouts(limit ? Number(limit) : 8);
  }
}
