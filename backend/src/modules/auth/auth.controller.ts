import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { AuthService, RequestMeta } from "./auth.service";
import {
  ChangePasswordInput,
  changePasswordSchema,
  LoginInput,
  loginSchema,
  PlatformLoginInput,
  platformLoginSchema,
  RefreshInput,
  refreshSchema,
  RegisterInput,
  registerSchema,
} from "./dto";
import { CurrentUser, ZodPipe, Public, RateLimit, AuthUser } from "../../common/decorators";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

function requestMeta(req: RequestLike): RequestMeta {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ??
    req.ip ??
    null;
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  return { ip, userAgent };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit({ limit: 10, windowSec: 3600 })
  @Post("register")
  register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Req() req: RequestLike) {
    return this.auth.register(body, requestMeta(req));
  }

  @Public()
  @RateLimit({ limit: 20, windowSec: 300 })
  @HttpCode(200)
  @Post("login")
  login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Req() req: RequestLike) {
    return this.auth.login(body, requestMeta(req));
  }

  @Public()
  @RateLimit({ limit: 10, windowSec: 300 })
  @HttpCode(200)
  @Post("platform/login")
  platformLogin(
    @Body(new ZodPipe(platformLoginSchema)) body: PlatformLoginInput,
    @Req() req: RequestLike,
  ) {
    return this.auth.platformLogin(body, requestMeta(req));
  }

  @Public()
  @RateLimit({ limit: 60, windowSec: 300 })
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body(new ZodPipe(refreshSchema)) body: RefreshInput, @Req() req: RequestLike) {
    return this.auth.refresh(body, requestMeta(req));
  }

  @Public()
  @RateLimit({ limit: 30, windowSec: 300 })
  @HttpCode(204)
  @Post("logout")
  async logout(@Body(new ZodPipe(refreshSchema)) body: RefreshInput): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @RateLimit({ limit: 240, windowSec: 60 })
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }

  @RateLimit({ limit: 10, windowSec: 3600 })
  @HttpCode(204)
  @Post("change-password")
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: RequestLike,
  ): Promise<void> {
    await this.auth.changePassword(user.sub, body, requestMeta(req));
  }
}
