import { Module } from "@nestjs/common";
import { TenantsController, PlatformTenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  controllers: [TenantsController, PlatformTenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
