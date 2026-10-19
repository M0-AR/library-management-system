import { z } from "zod";

export const listAuditLogsSchema = z.object({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
