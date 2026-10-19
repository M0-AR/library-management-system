import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { CommonModule } from "./common/common.module";
import { AuthGuard } from "./common/auth.guard";
import { RolesGuard } from "./common/roles.guard";
import { RateLimitGuard } from "./common/rate-limit.guard";
import { TenantContextInterceptor } from "./common/tenant.interceptor";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { UsersModule } from "./modules/users/users.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { BooksModule } from "./modules/books/books.module";
import { MembersModule } from "./modules/members/members.module";
import { LoansModule } from "./modules/loans/loans.module";
import { HoldsModule } from "./modules/holds/holds.module";
import { FinesModule } from "./modules/fines/fines.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { ExportsModule } from "./modules/exports/exports.module";
import { PublicModule } from "./modules/public/public.module";
import { MeModule } from "./modules/me/me.module";
import { BillingModule } from "./modules/billing/billing.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    CommonModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    BranchesModule,
    BooksModule,
    MembersModule,
    LoansModule,
    HoldsModule,
    FinesModule,
    NotificationsModule,
    DashboardModule,
    AuditLogsModule,
    ExportsModule,
    PublicModule,
    MeModule,
    BillingModule,
    JobsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
