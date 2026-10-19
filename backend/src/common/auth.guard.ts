import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY, AuthUser } from "./decorators";
import { unauthorized } from "./errors";
import type { UserRole } from "../db/schema";

export interface JwtClaims {
  sub: string;
  tid: string | null;
  role: UserRole;
  email: string;
  name: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw unauthorized();
    }
    const token = header.slice("Bearer ".length).trim();
    try {
      const claims = await this.jwt.verifyAsync<JwtClaims>(token);
      if (!claims.sub || !claims.role) throw new Error("malformed claims");
      const user: AuthUser = {
        sub: claims.sub,
        tid: claims.tid ?? null,
        role: claims.role,
        email: claims.email,
        name: claims.name,
      };
      request.user = user;
      return true;
    } catch {
      throw unauthorized("invalid_token", "Your session is invalid or has expired");
    }
  }
}
