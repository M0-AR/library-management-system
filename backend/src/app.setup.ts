import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { env } from "./env";

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  app.setGlobalPrefix("api/v1");
  const corsOrigins = env().CORS_ORIGINS;
  const allowedOrigins = corsOrigins
    ? corsOrigins
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [env().PUBLIC_APP_URL];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });
}
