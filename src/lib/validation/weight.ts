import { z } from 'zod';
import { dayISOSchema } from './meal';

export const weightEntrySchema = z.object({
  weightKg: z.coerce
    .number({ invalid_type_error: 'Το βάρος πρέπει να είναι αριθμός.' })
    .min(25, 'Το βάρος πρέπει να είναι τουλάχιστον 25 kg.')
    .max(400, 'Το βάρος δεν μπορεί να ξεπερνά τα 400 kg.'),
  entryDate: dayISOSchema,
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});

export type WeightEntryInput = z.infer<typeof weightEntrySchema>;

export const weightQuerySchema = z.object({
  from: dayISOSchema.optional(),
  to: dayISOSchema.optional(),
  limit: z.coerce.number().int().min(1).max(365).default(90),
});
