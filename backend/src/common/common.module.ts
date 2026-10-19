import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { RateLimiterService } from "./rate-limiter.service";

@Global()
@Module({
  providers: [AuditService, RateLimiterService],
  exports: [AuditService, RateLimiterService],
})
export class CommonModule {}
