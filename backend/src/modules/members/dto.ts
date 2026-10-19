import { z } from "zod";

export const memberCategorySchema = z.enum([
  "child",
  "student",
  "adult",
  "senior",
  "teacher",
  "staff",
  "external",
]);

export const createMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.email().max(254).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  category: memberCategorySchema.default("adult"),
  cardNumber: z.string().trim().min(2).max(40).optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const updateMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(200).optional(),
  email: z.email().max(254).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  category: memberCategorySchema.optional(),
  status: z.enum(["active", "suspended", "expired", "closed"]).optional(),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const listMembersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["active", "suspended", "expired", "closed"]).optional(),
  category: memberCategorySchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
