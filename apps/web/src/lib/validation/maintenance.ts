import { z } from 'zod';
import { CALORIE_LIMITS } from '../constants';
import { dayISOSchema } from './meal';

const weightKg = z.coerce
  .number({ invalid_type_error: 'Weight must be a number.' })
  .min(25, 'Weight must be at least 25 kg.')
  .max(400, 'Weight cannot exceed 400 kg.');

const macroGrams = z.coerce
  .number({ invalid_type_error: 'Value must be a number.' })
  .min(0, 'Negative values are not allowed.')
  .max(1000, 'Unrealistic value.')
  .nullable()
  .optional();

const calorieTarget = z.coerce
  .number({ invalid_type_error: 'Calorie target must be a number.' })
  .int('Calorie target must be a whole number.')
  .min(CALORIE_LIMITS.minDailyTarget, `Calorie target cannot be below ${CALORIE_LIMITS.minDailyTarget} kcal.`)
  .max(CALORIE_LIMITS.maxDailyTarget, `Calorie target cannot exceed ${CALORIE_LIMITS.maxDailyTarget} kcal.`);

const weeklyCalorie = z.coerce.number().int().min(0).max(80000).nullable().optional();

const rangeShape = {
  targetWeightKg: weightKg,
  lowerBoundaryKg: weightKg,
  upperBoundaryKg: weightKg,
};

/** lower < target < upper. */
function orderedRange<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((val, ctx) => {
    const v = val as { lowerBoundaryKg: number; upperBoundaryKg: number; targetWeightKg: number };
    if (!(v.lowerBoundaryKg < v.targetWeightKg)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lowerBoundaryKg'],
        message: 'Lower boundary must be below the target weight.',
      });
    }
    if (!(v.upperBoundaryKg > v.targetWeightKg)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['upperBoundaryKg'],
        message: 'Upper boundary must be above the target weight.',
      });
    }
  });
}

export const activateMaintenanceSchema = orderedRange(
  z.object({
    ...rangeShape,
    weighInsPerWeek: z.coerce.number().int().min(1).max(14).default(3),
    calorieTarget,
    /** true → set today's daily nutrition goal to this target now. Default false: never auto-change. */
    applyCalorieTarget: z.boolean().default(false),
    proteinGrams: macroGrams,
    carbohydrateGrams: macroGrams,
    fatGrams: macroGrams,
    weeklyCalorieMin: weeklyCalorie,
    weeklyCalorieMax: weeklyCalorie,
    alertSensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    /** Ενεργοποίηση απαιτεί ρητή επιβεβαίωση. */
    confirm: z.boolean().refine((v) => v === true, {
      message: 'Activation must be confirmed.',
    }),
  }),
);
export type ActivateMaintenanceInput = z.infer<typeof activateMaintenanceSchema>;

export const updateRangeSchema = orderedRange(
  z.object({
    ...rangeShape,
    reason: z.string().trim().max(300).optional(),
  }),
);
export type UpdateRangeInput = z.infer<typeof updateRangeSchema>;

export const updateTargetsSchema = z.object({
  calorieTarget,
  proteinGrams: macroGrams,
  carbohydrateGrams: macroGrams,
  fatGrams: macroGrams,
  weeklyCalorieMin: weeklyCalorie,
  weeklyCalorieMax: weeklyCalorie,
  alertSensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  weighInsPerWeek: z.coerce.number().int().min(1).max(14).optional(),
  /** true → also update today's daily nutrition goal. Default false. */
  applyCalorieTarget: z.boolean().default(false),
  effectiveFrom: dayISOSchema.optional(),
});
export type UpdateTargetsInput = z.infer<typeof updateTargetsSchema>;

export const changeModeSchema = z.object({
  mode: z.enum(['LOSS', 'MAINTENANCE', 'GAIN']),
  reason: z.string().trim().max(300).optional(),
  targetWeightKg: weightKg.optional(),
});
export type ChangeModeInput = z.infer<typeof changeModeSchema>;
