import { z } from "zod";
import {
  BrandingSettingsSchema,
  CirculationSettingsSchema,
  NotificationSettingsSchema,
  OpacSettingsSchema,
} from "./tenant-settings";
import { slugSchema } from "../auth/dto";

export const tenantSettingsPatchSchema = z.object({
  currency: z.string().length(3).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(16).optional(),
  branding: BrandingSettingsSchema.partial().optional(),
  circulation: CirculationSettingsSchema.partial().optional(),
  notifications: NotificationSettingsSchema.partial().optional(),
  opac: OpacSettingsSchema.partial().optional(),
});

export type TenantSettingsPatch = z.infer<typeof tenantSettingsPatchSchema>;

export const addDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Enter a valid domain"),
});

export type AddDomainInput = z.infer<typeof addDomainSchema>;

export const listTenantsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["active", "trial", "suspended", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const setTenantStatusSchema = z.object({
  status: z.enum(["active", "trial", "suspended", "cancelled"]),
});

export const setTenantPlanSchema = z.object({
  plan: z.enum(["free", "starter", "growth", "enterprise"]),
});

export const tenantSlugParamSchema = z.object({ slug: slugSchema });
