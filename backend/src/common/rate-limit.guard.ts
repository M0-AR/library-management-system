import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY, RATE_LIMIT_KEY, RateLimitOptions, AuthUser } from "./decorators";
import { tooManyRequests } from "./errors";
import { RateLimiterService } from "./rate-limiter.service";
import { env } from "../env";

const DEFAULT_AUTHENTICATED: RateLimitOptions = { limit: 600, windowSec: 60 };
const DEFAULT_ANONYMOUS: RateLimitOptions = { limit: 120, windowSec: 60 };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    if (!env().RATE_LIMIT_ENABLED) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const override = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const base = override ?? (user && !isPublic ? DEFAULT_AUTHENTICATED : DEFAULT_ANONYMOUS);
    const scope = base.scope ?? (user && !isPublic ? "user" : "ip");
    const ip =
      (request.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() as string | undefined) ??
      request.ip ??
      "unknown";
    const key = scope === "user" && user ? `u:${user.tid ?? "platform"}:${user.sub}` : `ip:${ip}`;

    const count = await this.limiter.hit(key, base.windowSec);
    if (count > base.limit) {
      const response = context.switchToHttp().getResponse();
      if (response?.header) response.header("Retry-After", String(base.windowSec));
      throw tooManyRequests();
    }
    return true;
  }
}
