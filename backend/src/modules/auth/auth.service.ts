import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { and, eq, isNull, sql as dsql } from "drizzle-orm";
import { branches, refreshTokens, tenants, users } from "../../db/schema";
import type { UserRole } from "../../db/schema";
import type { TenantSettings } from "../tenants/tenant-settings";
import { getDb, updateContext, withTenantContext } from "../../db/client";
import { conflict, forbidden, unauthorized } from "../../common/errors";
import { AuditService } from "../../common/audit.service";
import { env } from "../../env";
import { DEFAULT_TENANT_SETTINGS, parseTenantSettings } from "../tenants/tenant-settings";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiry } from "./tokens";
import type {
  ChangePasswordInput,
  LoginInput,
  PlatformLoginInput,
  RefreshInput,
  RegisterInput,
} from "./dto";

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

interface TokenUser {
  id: string;
  tenantId: string | null;
  role: UserRole;
  email: string;
  name: string;
}

export interface PublicUser {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  branchId: string | null;
}

export interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  settings: TenantSettings;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: PublicUser;
  tenant: PublicTenant | null;
}

const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "platform", "login", "register", "library", "static",
  "cdn", "assets", "mail", "support", "help", "docs", "blog", "status", "billing",
  "account", "dashboard", "opac", "signup", "signin",
]);

class RefreshReuseDetected extends Error {
  constructor(readonly userId: string) {
    super("refresh_reuse");
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<AuthTokensResponse> {
    if (RESERVED_SLUGS.has(input.slug)) {
      throw conflict("slug_reserved", "That library address is reserved");
    }
    const passwordHash = await hashPassword(input.password);
    const email = input.email.toLowerCase();

    return withTenantContext({ isPlatformAdmin: true }, async () => {
      const db = getDb();
      const existing = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);
      if (existing.length > 0) {
        throw conflict("slug_taken", "That library address is already taken");
      }

      const [tenant] = await db
        .insert(tenants)
        .values({
          slug: input.slug,
          name: input.libraryName,
          status: "trial",
          plan: "free",
          settings: DEFAULT_TENANT_SETTINGS as unknown as Record<string, unknown>,
        })
        .returning();
      const [branch] = await db
        .insert(branches)
        .values({ tenantId: tenant.id, name: "Main Library", code: "MAIN" })
        .returning();
      const [admin] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email,
          passwordHash,
          name: input.name,
          role: "tenant_admin",
          branchId: branch.id,
        })
        .returning();

      await updateContext({
        tenantId: tenant.id,
        userId: admin.id,
        isPlatformAdmin: false,
      });

      const tokens = await this.issueTokens(
        { id: admin.id, tenantId: tenant.id, role: "tenant_admin", email: admin.email, name: admin.name },
        meta,
      );
      await this.audit.log({
        action: "tenant.registered",
        entityType: "tenant",
        entityId: tenant.id,
        metadata: { slug: tenant.slug, email },
      });
      return { ...tokens, tenant: this.publicTenant(tenant) };
    });
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<AuthTokensResponse> {
    const email = input.email.toLowerCase();
    return withTenantContext({}, async () => {
      const db = getDb();
      const tenantRows = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);
      const tenant = tenantRows[0];
      if (!tenant) {
        await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
        throw unauthorized("invalid_credentials", "Incorrect email or password");
      }
      if (tenant.status === "suspended" || tenant.status === "cancelled") {
        throw forbidden("tenant_suspended", "This library account is not active");
      }

      await updateContext({ tenantId: tenant.id });
      const userRows = await db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenant.id), dsql`lower(${users.email}) = ${email}`))
        .limit(1);
      const user = userRows[0];
      const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user || !passwordOk) {
        throw unauthorized("invalid_credentials", "Incorrect email or password");
      }
      if (user.status !== "active") {
        throw forbidden("account_disabled", "This account has been disabled");
      }

      await updateContext({ userId: user.id });
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      const tokens = await this.issueTokens(
        { id: user.id, tenantId: user.tenantId, role: user.role, email: user.email, name: user.name },
        meta,
      );
      await this.audit.log({ action: "auth.login", entityType: "user", entityId: user.id });
      return { ...tokens, tenant: this.publicTenant(tenant) };
    });
  }

  async platformLogin(input: PlatformLoginInput, meta: RequestMeta): Promise<AuthTokensResponse> {
    const email = input.email.toLowerCase();
    return withTenantContext({ platformLogin: true }, async () => {
      const db = getDb();
      const userRows = await db
        .select()
        .from(users)
        .where(and(isNull(users.tenantId), dsql`lower(${users.email}) = ${email}`))
        .limit(1);
      const user = userRows[0];
      const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user || !passwordOk || user.role !== "platform_admin") {
        throw unauthorized("invalid_credentials", "Incorrect email or password");
      }
      if (user.status !== "active") {
        throw forbidden("account_disabled", "This account has been disabled");
      }

      await updateContext({ userId: user.id, isPlatformAdmin: true });
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      const tokens = await this.issueTokens(
        { id: user.id, tenantId: null, role: user.role, email: user.email, name: user.name },
        meta,
      );
      await this.audit.log({ action: "auth.platform_login", entityType: "user", entityId: user.id });
      return { ...tokens, tenant: null };
    });
  }

  async refresh(input: RefreshInput, meta: RequestMeta): Promise<AuthTokensResponse> {
    const tokenHash = hashRefreshToken(input.refreshToken);
    try {
      return await withTenantContext({ refreshLookup: true }, async () => {
        const db = getDb();
        const rows = await db
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, tokenHash))
          .limit(1);
        const token = rows[0];
        if (!token) {
          throw unauthorized("invalid_refresh", "Session expired, please sign in again");
        }
        if (token.revokedAt) {
          if (token.replacedById) throw new RefreshReuseDetected(token.userId);
          throw unauthorized("invalid_refresh", "Session expired, please sign in again");
        }
        if (token.expiresAt.getTime() <= Date.now()) {
          throw unauthorized("refresh_expired", "Session expired, please sign in again");
        }

      await updateContext({
        refreshLookup: false,
        tenantId: token.tenantId,
        platformLogin: token.tenantId === null,
        userId: token.userId,
      });

      const userRows = await db.select().from(users).where(eq(users.id, token.userId)).limit(1);
      const user = userRows[0];
      if (!user || user.status !== "active") {
        throw unauthorized("account_inactive", "Account is disabled, please contact support");
      }

      const newRefreshToken = generateRefreshToken();
      const [newRow] = await db
        .insert(refreshTokens)
        .values({
          tenantId: user.tenantId,
          userId: user.id,
          tokenHash: hashRefreshToken(newRefreshToken),
          expiresAt: refreshTokenExpiry(env().REFRESH_TOKEN_TTL_DAYS),
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        })
        .returning({ id: refreshTokens.id });
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedById: newRow.id })
        .where(eq(refreshTokens.id, token.id));

      const accessToken = await this.signAccess({
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
      });

      let tenant: PublicTenant | null = null;
      if (user.tenantId) {
        const tenantRows = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
        tenant = tenantRows[0] ? this.publicTenant(tenantRows[0]) : null;
      }

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: env().JWT_ACCESS_TTL,
        user: this.publicUser(user),
        tenant,
      };
      });
    } catch (error) {
      if (error instanceof RefreshReuseDetected) {
        await this.revokeUserTokens(error.userId);
        throw unauthorized("refresh_reuse", "Session revoked for security, please sign in again");
      }
      throw error;
    }
  }

  private async revokeUserTokens(userId: string): Promise<void> {
    await withTenantContext({ refreshLookup: true }, async () => {
      await getDb()
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await withTenantContext({ refreshLookup: true }, async () => {
      await getDb()
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
    });
  }

  async me(userId: string): Promise<{ user: PublicUser; tenant: PublicTenant | null }> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) throw unauthorized();
    let tenant: PublicTenant | null = null;
    if (user.tenantId) {
      const tenantRows = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
      tenant = tenantRows[0] ? this.publicTenant(tenantRows[0]) : null;
    }
    return { user: this.publicUser(user), tenant };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    meta: RequestMeta,
  ): Promise<void> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) throw unauthorized();
    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) throw unauthorized("invalid_password", "Your current password is incorrect");
    const passwordHash = await hashPassword(input.newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    await this.audit.log({
      action: "auth.password_changed",
      entityType: "user",
      entityId: userId,
      ip: meta.ip ?? null,
    });
  }

  private async signAccess(user: TokenUser): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      tid: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    });
  }

  private async issueTokens(
    user: TokenUser,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string; user: PublicUser }> {
    const accessToken = await this.signAccess(user);
    const refreshToken = generateRefreshToken();
    await getDb()
      .insert(refreshTokens)
      .values({
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiry(env().REFRESH_TOKEN_TTL_DAYS),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      });
    const full = await getDb().select().from(users).where(eq(users.id, user.id)).limit(1);
    return {
      accessToken,
      refreshToken,
      expiresIn: env().JWT_ACCESS_TTL,
      user: this.publicUser(full[0] ?? { ...user, branchId: null }),
    };
  }

  private publicUser(user: {
    id: string;
    tenantId: string | null;
    email: string;
    name: string;
    role: UserRole;
    branchId?: string | null;
  }): PublicUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId ?? null,
    };
  }

  private publicTenant(tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    plan: string;
    settings: unknown;
  }): PublicTenant {
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      settings: parseTenantSettings(tenant.settings),
    };
  }
}
