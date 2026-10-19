import { Module } from "@nestjs/common";
import { LoansModule } from "../loans/loans.module";
import { HoldsModule } from "../holds/holds.module";
import { FinesModule } from "../fines/fines.module";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

@Module({
  imports: [LoansModule, HoldsModule, FinesModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
