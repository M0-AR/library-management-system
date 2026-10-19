import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { HoldsController } from "./holds.controller";
import { HoldsService } from "./holds.service";

@Module({
  imports: [NotificationsModule],
  controllers: [HoldsController],
  providers: [HoldsService],
  exports: [HoldsService],
})
export class HoldsModule {}
