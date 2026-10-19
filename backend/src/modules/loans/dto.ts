import { z } from "zod";

export const checkoutSchema = z
  .object({
    barcode: z.string().trim().min(1).max(64).optional(),
    copyId: z.uuid().optional(),
    cardNumber: z.string().trim().min(1).max(40).optional(),
    memberId: z.uuid().optional(),
  })
  .refine((value) => value.barcode || value.copyId, {
    message: "Provide a copy barcode or copyId",
    path: ["barcode"],
  })
  .refine((value) => value.cardNumber || value.memberId, {
    message: "Provide a member card number or memberId",
    path: ["cardNumber"],
  });

export const checkinSchema = z
  .object({
    barcode: z.string().trim().min(1).max(64).optional(),
    copyId: z.uuid().optional(),
  })
  .refine((value) => value.barcode || value.copyId, {
    message: "Provide a copy barcode or copyId",
    path: ["barcode"],
  });

export const listLoansSchema = z.object({
  status: z.enum(["active", "overdue", "returned"]).optional(),
  memberId: z.uuid().optional(),
  bookId: z.uuid().optional(),
  overdue: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type ListLoansQuery = z.infer<typeof listLoansSchema>;
