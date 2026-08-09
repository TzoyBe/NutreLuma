import { z } from 'zod';
import { CALORIE_LIMITS } from '../constants';
import { dayISOSchema } from './meal';

/**
 * Οι στόχοι περνούν από τα ίδια λογικά όρια με την αυτόματη πρόταση, ώστε να
 * μην μπορεί να οριστεί χειροκίνητα επικίνδυνα χαμηλή ημερήσια πρόσληψη.
 */
const targetGrams = z.coerce
  .number({ invalid_type_error: 'Η τιμή πρέπει να είναι αριθμός.' })
  .min(0, 'Δεν επιτρέπονται αρνητικές τιμές.')
  .max(1000, 'Μη ρεαλιστική τιμή.')
  .nullable()
  .optional();

export const setGoalSchema = z.object({
  effectiveFrom: dayISOSchema.optional(),
  source: z.enum(['AUTO', 'MANUAL']).optional(),
  calorieTarget: z.coerce
    .number({ invalid_type_error: 'Ο στόχος πρέπει να είναι αριθμός.' })
    .int('Ο στόχος πρέπει να είναι ακέραιος αριθμός.')
    .min(
      CALORIE_LIMITS.minDailyTarget,
      `Ο στόχος δεν μπορεί να είναι κάτω από ${CALORIE_LIMITS.minDailyTarget} kcal.`,
    )
    .max(
      CALORIE_LIMITS.maxDailyTarget,
      `Ο στόχος δεν μπορεί να ξεπερνά τις ${CALORIE_LIMITS.maxDailyTarget} kcal.`,
    ),
  proteinGrams: targetGrams,
  carbohydrateGrams: targetGrams,
  fatGrams: targetGrams,
  fiberGrams: targetGrams,
  waterMl: z.coerce
    .number({ invalid_type_error: 'Η τιμή πρέπει να είναι αριθμός.' })
    .int()
    .min(200, 'Ο στόχος νερού είναι μη ρεαλιστικά χαμηλός.')
    .max(8000, 'Ο στόχος νερού είναι μη ρεαλιστικά υψηλός.')
    .nullable()
    .optional(),
});

export type SetGoalInput = z.infer<typeof setGoalSchema>;
