import { z } from "zod";

export const checkoutPlanSchema = z.object({
  plan: z.enum(["starter", "growth", "enterprise"]),
});

export type CheckoutPlanInput = z.infer<typeof checkoutPlanSchema>;
