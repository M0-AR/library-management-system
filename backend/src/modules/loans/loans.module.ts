import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { LoansController } from "./loans.controller";
import { LoansService } from "./loans.service";

@Module({
  imports: [NotificationsModule],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
