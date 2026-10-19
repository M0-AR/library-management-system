import { z } from "zod";

export const publicBooksQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  author: z.string().trim().max(200).optional(),
  available: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  sort: z.enum(["title", "recent"]).default("title"),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(50).optional(),
});

export const domainQuerySchema = z.object({
  domain: z.string().trim().min(1).max(255),
});

export type PublicBooksQuery = z.infer<typeof publicBooksQuerySchema>;
export type DomainQuery = z.infer<typeof domainQuerySchema>;
