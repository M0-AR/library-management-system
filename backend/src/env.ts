import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const boolFromString = (def: boolean) =>
  z
    .preprocess(
      emptyToUndefined,
      z.enum(["true", "false"]).optional(),
    )
    .transform((v) => (v === undefined ? def : v === "true"));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_VERSION: z.string().default("1.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_ADMIN: optionalString,
  APP_DB_ROLE: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/)
    .default("app_user"),
  APP_DB_PASSWORD: z.string().default(""),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(200).default(20),

  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: optionalString,
  RATE_LIMIT_ENABLED: boolFromString(true),
  REDIS_URL: optionalString,

  PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  APP_DOMAIN: z.string().default("localhost"),

  BILLING_PROVIDER: z.enum(["stub", "paddle"]).default("stub"),
  PADDLE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  PADDLE_API_KEY: optionalString,
  PADDLE_WEBHOOK_SECRET: optionalString,
  PADDLE_PRICE_STARTER: optionalString,
  PADDLE_PRICE_GROWTH: optionalString,
  PADDLE_PRICE_ENTERPRISE: optionalString,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: z.string().default("Library Cloud <no-reply@example.com>"),

  JOBS_ENABLED: boolFromString(true),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
