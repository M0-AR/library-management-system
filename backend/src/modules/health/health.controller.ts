import { Controller, Get } from "@nestjs/common";
import { sql as dsql } from "drizzle-orm";
import { Public, RateLimit } from "../../common/decorators";
import { RateLimiterService } from "../../common/rate-limiter.service";
import { getDb } from "../../db/client";
import { env } from "../../env";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly limiter: RateLimiterService) {}

  @Get()
  @RateLimit({ limit: 600, windowSec: 60, scope: "ip" })
  async check() {
    await getDb().execute(dsql`select 1`);
    const redisUp = await this.limiter.ping();
    return {
      status: "ok",
      version: env().APP_VERSION,
      environment: env().NODE_ENV,
      database: "up",
      rateLimitStore: redisUp ? "redis" : "memory",
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
