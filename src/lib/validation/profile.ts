import { z } from 'zod';
import { ACTIVITY_LEVELS, CALORIE_LIMITS, GENDERS, GOALS, UNITS } from '../constants';
import { isValidTimezone } from '../dates';

const isoDate = z
  .string({ required_error: 'Η ημερομηνία γέννησης είναι υποχρεωτική.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Δώσε έγκυρη ημερομηνία (YYYY-MM-DD).');

export const healthProfileSchema = z.object({
  firstName: z.string().trim().min(2, 'Το όνομα είναι υποχρεωτικό.').max(60),
  lastName: z.string().trim().max(60).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  birthDate: isoDate.refine(
    (value) => {
      const d = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return false;
      const year = d.getUTCFullYear();
      return year >= 1900 && d.getTime() < Date.now();
    },
    { message: 'Η ημερομηνία γέννησης δεν είναι έγκυρη.' },
  ),
  gender: z.enum(GENDERS).default('UNDISCLOSED'),
  heightCm: z.coerce
    .number({ invalid_type_error: 'Το ύψος πρέπει να είναι αριθμός.' })
    .min(80, 'Το ύψος πρέπει να είναι τουλάχιστον 80 cm.')
    .max(260, 'Το ύψος δεν μπορεί να ξεπερνά τα 260 cm.'),
  currentWeightKg: z.coerce
    .number({ invalid_type_error: 'Το βάρος πρέπει να είναι αριθμός.' })
    .min(25, 'Το βάρος πρέπει να είναι τουλάχιστον 25 kg.')
    .max(400, 'Το βάρος δεν μπορεί να ξεπερνά τα 400 kg.'),
  targetWeightKg: z
    .union([z.coerce.number().min(25).max(400), z.literal('').transform(() => undefined)])
    .optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).default('MODERATE'),
  goal: z.enum(GOALS).default('MAINTAIN'),
  dailyCalorieTarget: z
    .union([
      z.coerce
        .number()
        .int('Ο στόχος πρέπει να είναι ακέραιος.')
        .min(CALORIE_LIMITS.minDailyTarget, `Ελάχιστος στόχος: ${CALORIE_LIMITS.minDailyTarget} kcal.`)
        .max(CALORIE_LIMITS.maxDailyTarget, `Μέγιστος στόχος: ${CALORIE_LIMITS.maxDailyTarget} kcal.`),
      z.literal('').transform(() => undefined),
    ])
    .optional(),
  preferredUnits: z.enum(UNITS).default('METRIC'),
  timezone: z
    .string()
    .default('Europe/Athens')
    .refine((tz) => isValidTimezone(tz), { message: 'Μη έγκυρη ζώνη ώρας.' }),
});

export type HealthProfileInput = z.infer<typeof healthProfileSchema>;

export const updateAccountSchema = z.object({
  displayName: z.string().trim().min(2, 'Το όνομα εμφάνισης είναι υποχρεωτικό.').max(60),
});
