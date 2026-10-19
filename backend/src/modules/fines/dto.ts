import { z } from "zod";

export const listFinesSchema = z.object({
  status: z.enum(["outstanding", "paid", "waived"]).optional(),
  type: z.enum(["overdue", "lost", "damaged", "manual"]).optional(),
  memberId: z.uuid().optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export const createFineSchema = z
  .object({
    memberId: z.uuid().optional(),
    cardNumber: z.string().trim().min(1).max(40).optional(),
    type: z.enum(["damaged", "manual"]).default("manual"),
    amountCents: z.coerce.number().int().positive().max(100_000_000),
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.memberId || value.cardNumber, {
    message: "Provide a member card number or memberId",
    path: ["cardNumber"],
  });

export const fineActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type ListFinesQuery = z.infer<typeof listFinesSchema>;
export type CreateFineInput = z.infer<typeof createFineSchema>;
export type FineActionInput = z.infer<typeof fineActionSchema>;
