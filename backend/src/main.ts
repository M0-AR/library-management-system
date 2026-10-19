import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { closeDb, initDb } from "./db/client";
import { env } from "./env";

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ trustProxy: true });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    rawBody: true,
  });

  await configureApp(app);
  app.enableShutdownHooks();

  await initDb(env().DATABASE_URL, { max: env().DB_POOL_MAX });
  const port = env().PORT;
  await app.listen({ port, host: "0.0.0.0" });

  const shutdown = async (signal: string): Promise<void> => {
    process.stdout.write(`\nReceived ${signal}, shutting down...\n`);
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.stdout.write(
    `Library Cloud API listening on http://0.0.0.0:${port}/api/v1 (${env().NODE_ENV})\n`,
  );
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Failed to start server:\n${message}\n`);
  process.exit(1);
});
