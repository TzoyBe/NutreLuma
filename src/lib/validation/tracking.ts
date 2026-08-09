import { z } from 'zod';

function isRealUTCDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

export const dayISOSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Μη έγκυρη ημερομηνία.')
  .refine(isRealUTCDate, 'Μη έγκυρη ημερομηνία.');

export const ACTIVITY_KINDS = ['WORKOUT', 'WALK', 'RUN', 'CYCLE', 'OTHER'] as const;

export const waterEntrySchema = z.object({
  entryDate: dayISOSchema,
  volumeMl: z.coerce
    .number({ invalid_type_error: 'Η ποσότητα πρέπει να είναι αριθμός.' })
    .int('Ακέραιος αριθμός ml.')
    .min(1, 'Δώσε θετική ποσότητα.')
    .max(20000, 'Μη ρεαλιστική ποσότητα.'),
});
export type WaterEntryInput = z.infer<typeof waterEntrySchema>;

export const trackingListQuerySchema = z
  .object({
    from: dayISOSchema.optional(),
    to: dayISOSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: 'Το αρχικό διάστημα δεν μπορεί να είναι μετά το τελικό.',
    path: ['from'],
  });
export type TrackingListQueryInput = z.input<typeof trackingListQuerySchema>;

export const activityEntrySchema = z
  .object({
    entryDate: dayISOSchema,
    kind: z.enum(ACTIVITY_KINDS).default('OTHER'),
    steps: z.coerce.number().int().min(0).max(200000).nullable().optional(),
    durationMin: z.coerce.number().int().min(0).max(1440).nullable().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => (d.steps ?? 0) > 0 || (d.durationMin ?? 0) > 0, {
    message: 'Δώσε βήματα ή διάρκεια.',
    path: ['steps'],
  });
export type ActivityEntryInput = z.infer<typeof activityEntrySchema>;
