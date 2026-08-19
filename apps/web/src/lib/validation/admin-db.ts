import { z } from 'zod';

export const rowsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
});
export type RowsQueryInput = z.infer<typeof rowsQuerySchema>;

/**
 * Το update payload είναι δυναμικό (πεδία ανά model). Δεχόμαστε primitives + null·
 * η τυποποίηση/επικύρωση ανά πεδίο γίνεται με `coerceValue` βάσει του DMMF.
 */
export const updateRowSchema = z.object({
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type UpdateRowInput = z.infer<typeof updateRowSchema>;
