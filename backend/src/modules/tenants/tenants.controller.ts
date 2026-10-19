import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles, ZodPipe } from "../../common/decorators";
import { TenantsService } from "./tenants.service";
import {
  AddDomainInput,
  addDomainSchema,
  listTenantsSchema,
  setTenantPlanSchema,
  setTenantStatusSchema,
  TenantSettingsPatch,
  tenantSettingsPatchSchema,
} from "./dto";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Roles("tenant_admin")
  @Get("me")
  getCurrent() {
    return this.tenants.getCurrent();
  }

  @Roles("tenant_admin")
  @Patch("me/settings")
  updateSettings(@Body(new ZodPipe(tenantSettingsPatchSchema)) body: TenantSettingsPatch) {
    return this.tenants.updateSettings(body);
  }

  @Roles("tenant_admin")
  @Get("me/domains")
  listDomains() {
    return this.tenants.listDomains();
  }

  @Roles("tenant_admin")
  @Post("me/domains")
  addDomain(@Body(new ZodPipe(addDomainSchema)) body: AddDomainInput) {
    return this.tenants.addDomain(body);
  }

  @Roles("tenant_admin")
  @Post("me/domains/:id/verify")
  verifyDomain(@Param("id") id: string) {
    return this.tenants.verifyDomain(id);
  }

  @Roles("tenant_admin")
  @Delete("me/domains/:id")
  removeDomain(@Param("id") id: string) {
    return this.tenants.removeDomain(id);
  }
}

@Controller("tenants")
export class PlatformTenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Roles("platform_admin")
  @Get()
  list(@Query(new ZodPipe(listTenantsSchema)) query: ReturnType<typeof listTenantsSchema.parse>) {
    return this.tenants.listAll(query);
  }

  @Roles("platform_admin")
  @Get("growth")
  growth(@Query("days") days?: string) {
    return this.tenants.tenantGrowth(Math.min(365, Math.max(7, Number(days ?? 30))));
  }

  @Roles("platform_admin")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.tenants.getTenant(id);
  }

  @Roles("platform_admin")
  @Patch(":id/status")
  setStatus(
    @Param("id") id: string,
    @Body(new ZodPipe(setTenantStatusSchema)) body: { status: "active" | "trial" | "suspended" | "cancelled" },
  ) {
    return this.tenants.setStatus(id, body.status);
  }

  @Roles("platform_admin")
  @Patch(":id/plan")
  setPlan(
    @Param("id") id: string,
    @Body(new ZodPipe(setTenantPlanSchema)) body: { plan: "free" | "starter" | "growth" | "enterprise" },
  ) {
    return this.tenants.setPlan(id, body.plan);
  }
}
