import { z } from "zod";

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,39}$/,
    "Address must be 2-40 characters: lowercase letters, numbers and hyphens",
  );

export const registerSchema = z.object({
  libraryName: z.string().trim().min(2).max(120),
  slug: slugSchema,
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  password: passwordSchema,
});

export const loginSchema = z.object({
  slug: slugSchema,
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const platformLoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(512),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
