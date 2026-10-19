import { z } from "zod";

export const updateProfileSchema = z.object({
  email: z.email().max(160).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
});

export const placeMeHoldSchema = z.object({
  bookId: z.uuid(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type PlaceMeHoldInput = z.infer<typeof placeMeHoldSchema>;
