import { z } from "zod";

export const CirculationSettingsSchema = z.object({
  loanPeriodDays: z.number().int().min(1).max(365).default(14),
  renewalPeriodDays: z.number().int().min(1).max(365).default(14),
  maxRenewals: z.number().int().min(0).max(10).default(2),
  maxLoansPerMember: z.number().int().min(1).max(200).default(10),
  gracePeriodDays: z.number().int().min(0).max(60).default(1),
  finePerDayCents: z.number().int().min(0).max(100000).default(25),
  maxOutstandingFineCents: z.number().int().min(0).max(10000000).default(5000),
  lostItemFeeCents: z.number().int().min(0).max(10000000).default(3000),
  holdsEnabled: z.boolean().default(true),
  holdShelfExpiryDays: z.number().int().min(1).max(60).default(3),
});

export const BrandingSettingsSchema = z.object({
  displayName: z.string().max(120).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#4f46e5"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#0ea5e9"),
  logoUrl: z.string().url().max(500).optional(),
  faviconUrl: z.string().url().max(500).optional(),
  welcomeMessage: z.string().max(500).optional(),
});

export const NotificationSettingsSchema = z.object({
  emailEnabled: z.boolean().default(true),
  dueSoonDaysBefore: z.number().int().min(1).max(30).default(3),
  overdueRemindersEnabled: z.boolean().default(true),
  holdReadyEmails: z.boolean().default(true),
});

export const OpacSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  showCovers: z.boolean().default(true),
  requireLoginToPlaceHolds: z.boolean().default(true),
});

export const TenantSettingsSchema = z.object({
  currency: z.string().length(3).default("USD"),
  timezone: z.string().max(64).default("UTC"),
  locale: z.string().max(16).default("en"),
  branding: BrandingSettingsSchema.prefault({}),
  circulation: CirculationSettingsSchema.prefault({}),
  notifications: NotificationSettingsSchema.prefault({}),
  opac: OpacSettingsSchema.prefault({}),
});

export type TenantSettings = z.output<typeof TenantSettingsSchema>;
export type CirculationSettings = z.output<typeof CirculationSettingsSchema>;

export const DEFAULT_TENANT_SETTINGS: TenantSettings = TenantSettingsSchema.parse({});

export function parseTenantSettings(raw: unknown): TenantSettings {
  return TenantSettingsSchema.parse(raw ?? {});
}
