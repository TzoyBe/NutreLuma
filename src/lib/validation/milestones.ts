import { z } from 'zod';
import { dayISOSchema } from './tracking';

export const MILESTONE_TYPES = [
  'TARGET_WEIGHT',
  'WEIGHT_LOSS_AMOUNT',
  'WEIGHT_GAIN_AMOUNT',
  'MEAL_LOGGING_DAYS',
  'MEAL_LOGGING_STREAK',
  'WEIGH_IN_FREQUENCY',
  'CALORIE_TARGET_DAYS',
  'PROTEIN_TARGET_DAYS',
  'WATER_TARGET_DAYS',
  'STEP_TARGET_DAYS',
  'ACTIVITY_TARGET',
  'CUSTOM_NUMERIC',
] as const;

export const MILESTONE_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'MISSED',
  'CANCELLED',
  'PAUSED',
] as const;

const decimalNumber = z.coerce
  .number({ invalid_type_error: 'Η τιμή πρέπει να είναι αριθμός.' })
  .finite('Η τιμή πρέπει να είναι έγκυρος αριθμός.')
  .max(1_000_000, 'Μη ρεαλιστική τιμή.');

const milestoneBaseSchema = z.object({
  title: z.string().trim().min(1, 'Ο τίτλος είναι υποχρεωτικός.').max(120),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  type: z.enum(MILESTONE_TYPES),
  unit: z.string().trim().max(24).optional().or(z.literal('')),
  startValue: decimalNumber.min(0, 'Δεν επιτρέπονται αρνητικές τιμές.').optional().nullable(),
  targetValue: decimalNumber.gt(0, 'Ο στόχος πρέπει να είναι θετικός.'),
  dailyThreshold: decimalNumber
    .gt(0, 'Το ημερήσιο όριο πρέπει να είναι θετικό.')
    .optional()
    .nullable(),
  startDate: dayISOSchema,
  endDate: dayISOSchema.optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE']).optional().default('ACTIVE'),
});

export const createMilestoneSchema = milestoneBaseSchema
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: 'Η λήξη δεν μπορεί να είναι πριν από την έναρξη.',
    path: ['endDate'],
  })
  .refine(
    (d) =>
      d.type !== 'STEP_TARGET_DAYS' ||
      (d.dailyThreshold !== null && d.dailyThreshold !== undefined),
    {
    message: 'Δώσε ημερήσιο στόχο βημάτων.',
    path: ['dailyThreshold'],
    },
  );

export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;

export const updateMilestoneSchema = milestoneBaseSchema
  .omit({ type: true, status: true })
  .partial()
  .refine((d) => !d.endDate || !d.startDate || d.endDate >= d.startDate, {
    message: 'Η λήξη δεν μπορεί να είναι πριν από την έναρξη.',
    path: ['endDate'],
  });

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const milestoneListQuerySchema = z.object({
  status: z.enum(MILESTONE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type MilestoneListQueryInput = z.input<typeof milestoneListQuerySchema>;
