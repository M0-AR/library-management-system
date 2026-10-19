import { z } from "zod";

export const placeHoldSchema = z
  .object({
    bookId: z.uuid(),
    memberId: z.uuid().optional(),
    cardNumber: z.string().trim().min(1).max(40).optional(),
    branchId: z.uuid().optional(),
  })
  .refine((value) => value.memberId || value.cardNumber, {
    message: "Provide a member card number or memberId",
    path: ["cardNumber"],
  });

export const listHoldsSchema = z.object({
  status: z.enum(["pending", "ready", "fulfilled", "cancelled", "expired"]).optional(),
  memberId: z.uuid().optional(),
  bookId: z.uuid().optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type PlaceHoldInput = z.infer<typeof placeHoldSchema>;
export type ListHoldsQuery = z.infer<typeof listHoldsSchema>;
