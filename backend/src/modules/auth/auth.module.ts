import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { env } from "../../env";
import { CommonModule } from "../../common/common.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    CommonModule,
    JwtModule.register({
      global: true,
      secret: env().JWT_SECRET,
      signOptions: { expiresIn: env().JWT_ACCESS_TTL as unknown as number },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
