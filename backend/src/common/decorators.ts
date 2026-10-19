import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import type { UserRole } from "../db/schema";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface RateLimitOptions {
  limit: number;
  windowSec: number;
  scope?: "ip" | "user";
}

export const RATE_LIMIT_KEY = "rateLimit";
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

export interface AuthUser {
  sub: string;
  tid: string | null;
  role: UserRole;
  email: string;
  name: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);

export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new BadRequestException({
        error: { code: "validation_failed", message: "Validation failed", details: issues },
      });
    }
    return result.data;
  }
}
