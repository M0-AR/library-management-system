import { z } from "zod";
import { passwordSchema } from "../auth/dto";

export const staffRoleSchema = z.enum(["tenant_admin", "librarian", "assistant"]);

export const createUserSchema = z
  .object({
    email: z.email().max(254),
    name: z.string().trim().min(2).max(120),
    password: passwordSchema,
    role: z.enum(["tenant_admin", "librarian", "assistant", "patron"]),
    branchId: z.uuid().nullable().optional(),
    memberId: z.uuid().optional(),
  })
  .refine((value) => value.role !== "patron" || !!value.memberId, {
    message: "memberId is required for patron accounts",
    path: ["memberId"],
  })
  .refine((value) => value.role === "patron" || !value.memberId, {
    message: "memberId is only allowed for patron accounts",
    path: ["memberId"],
  });

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: staffRoleSchema.optional(),
  branchId: z.uuid().nullable().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const listUsersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: staffRoleSchema.optional(),
  status: z.enum(["active", "disabled"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
