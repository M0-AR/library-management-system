import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HoldsModule } from "../holds/holds.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { JobsService } from "./jobs.service";

@Module({
  imports: [ScheduleModule.forRoot(), HoldsModule, NotificationsModule],
  providers: [JobsService],
})
export class JobsModule {}
