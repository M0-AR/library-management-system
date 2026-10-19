import { z } from "zod";

export const isbnParamSchema = z.object({
  isbn: z
    .string()
    .transform((v) => v.replace(/[-\s]/g, ""))
    .pipe(z.string().regex(/^(?:\d{9}[\dXx]|\d{13})$/, "Enter a valid ISBN-10 or ISBN-13")),
});

export const createBookSchema = z.object({
  title: z.string().trim().min(1).max(500),
  subtitle: z.string().trim().max(500).nullable().optional(),
  authors: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  isbn13: z.string().trim().max(20).nullable().optional(),
  isbn10: z.string().trim().max(20).nullable().optional(),
  publisher: z.string().trim().max(300).nullable().optional(),
  publishedYear: z.number().int().min(1000).max(2100).nullable().optional(),
  language: z.string().trim().max(16).default("en"),
  pages: z.number().int().min(1).max(50000).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  coverUrl: z.string().url().max(1000).nullable().optional(),
  categories: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  dewey: z.string().trim().max(30).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateBookSchema = createBookSchema.partial();

export const listBooksSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  status: z.enum(["active", "archived"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(["recent", "title"]).optional(),
});

export const createCopiesSchema = z.object({
  branchId: z.uuid(),
  count: z.number().int().min(1).max(200).default(1),
  barcodes: z.array(z.string().trim().min(1).max(64)).max(200).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  condition: z.string().trim().max(60).nullable().optional(),
  priceCents: z.number().int().min(0).max(100000000).nullable().optional(),
  acquiredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const updateCopySchema = z.object({
  branchId: z.uuid().optional(),
  status: z.enum(["available", "lost", "damaged", "withdrawn"]).optional(),
  condition: z.string().trim().max(60).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  priceCents: z.number().int().min(0).max(100000000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type CreateCopiesInput = z.infer<typeof createCopiesSchema>;
export type UpdateCopyInput = z.infer<typeof updateCopySchema>;
