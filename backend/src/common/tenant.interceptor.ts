import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { from, lastValueFrom, Observable } from "rxjs";
import { tenants, users } from "../db/schema";
import { getDb, withTenantContext } from "../db/client";
import { forbidden } from "./errors";
import type { AuthUser } from "./decorators";

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return next.handle();

    return from(
      withTenantContext(
        {
          tenantId: user.tid,
          userId: user.sub,
          isPlatformAdmin: user.role === "platform_admin",
        },
        async () => {
          const rows = await getDb()
            .select({
              id: users.id,
              tenantId: users.tenantId,
              email: users.email,
              name: users.name,
              role: users.role,
              status: users.status,
            })
            .from(users)
            .where(eq(users.id, user.sub))
            .limit(1);
          const fresh = rows[0];
          if (!fresh || fresh.status !== "active") {
            throw new UnauthorizedException({
              error: { code: "account_inactive", message: "Account is disabled or no longer exists" },
            });
          }
          if ((fresh.tenantId ?? null) !== (user.tid ?? null)) {
            throw new UnauthorizedException({
              error: { code: "tenant_mismatch", message: "Session tenant no longer matches account" },
            });
          }
          if (fresh.tenantId) {
            const tenantRows = await getDb()
              .select({ status: tenants.status })
              .from(tenants)
              .where(eq(tenants.id, fresh.tenantId))
              .limit(1);
            const status = tenantRows[0]?.status;
            if (status === "suspended" || status === "cancelled") {
              throw forbidden("tenant_suspended", "This library account is not active");
            }
          }
          request.user = {
            sub: fresh.id,
            tid: fresh.tenantId,
            role: fresh.role,
            email: fresh.email,
            name: fresh.name,
          } satisfies AuthUser;
          return lastValueFrom(next.handle());
        },
      ),
    );
  }
}
