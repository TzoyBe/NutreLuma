import { z } from 'zod';
import { CALORIE_LIMITS, MEAL_TYPES } from '../constants';

const calorieField = z.coerce
  .number({ invalid_type_error: 'Οι θερμίδες πρέπει να είναι αριθμός.' })
  .int('Οι θερμίδες πρέπει να είναι ακέραιος αριθμός.')
  .min(CALORIE_LIMITS.minPerMeal, 'Δεν επιτρέπονται αρνητικές θερμίδες.')
  .max(CALORIE_LIMITS.hardMaxPerMeal, `Μέγιστο ${CALORIE_LIMITS.hardMaxPerMeal} kcal ανά γεύμα.`);

export const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Μη έγκυρη ημερομηνία/ώρα.');

export const dayISOSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Μη έγκυρη ημερομηνία.');

/** Μεταδεδομένα που συνοδεύουν το upload (multipart fields). */
export const createMealSchema = z.object({
  mealType: z.enum(MEAL_TYPES).default('OTHER'),
  mealDateTime: localDateTimeSchema,
  notes: z.string().trim().max(500, 'Η σημείωση δεν μπορεί να ξεπερνά τους 500 χαρακτήρες.').optional(),
  title: z.string().trim().max(120).optional(),
  requestKey: z.string().trim().min(8).max(64).optional(),
});

export type CreateMealInput = z.infer<typeof createMealSchema>;

/** Γραμμάρια μακροθρεπτικών. `null` σημαίνει «άγνωστο», όχι μηδέν. */
const gramsField = z.coerce
  .number({ invalid_type_error: 'Η τιμή πρέπει να είναι αριθμός.' })
  .min(0, 'Δεν επιτρέπονται αρνητικές τιμές.')
  .max(2000, 'Μη ρεαλιστική τιμή.')
  .nullable()
  .optional();

const sodiumField = z.coerce
  .number({ invalid_type_error: 'Η τιμή πρέπει να είναι αριθμός.' })
  .int()
  .min(0, 'Δεν επιτρέπονται αρνητικές τιμές.')
  .max(100000, 'Μη ρεαλιστική τιμή.')
  .nullable()
  .optional();

export const macroFieldsSchema = z.object({
  proteinGrams: gramsField,
  carbohydrateGrams: gramsField,
  fatGrams: gramsField,
  fiberGrams: gramsField,
  sugarGrams: gramsField,
  saturatedFatGrams: gramsField,
  sodiumMg: sodiumField,
});

export type MacroFieldsInput = z.infer<typeof macroFieldsSchema>;

export const mealItemSchema = z
  .object({
    id: z.string().cuid().optional(),
    name: z.string().trim().min(1, 'Το όνομα τροφίμου είναι υποχρεωτικό.').max(120),
    estimatedQuantity: z.string().trim().max(60).optional().or(z.literal('')),
    finalCalories: calorieField,
  })
  .merge(macroFieldsSchema);

/** Χειροκίνητη καταχώριση: χωρίς φωτογραφία, χωρίς AI. */
export const manualMealSchema = z
  .object({
    mealType: z.enum(MEAL_TYPES).default('OTHER'),
    mealDateTime: localDateTimeSchema,
    title: z.string().trim().max(120).optional().or(z.literal('')),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
    finalCalories: calorieField.optional(),
    items: z.array(mealItemSchema).max(30, 'Πάρα πολλά τρόφιμα.').optional(),
    acknowledgeHighCalories: z.boolean().optional().default(false),
    requestKey: z.string().trim().min(8).max(64).optional(),
  })
  .merge(macroFieldsSchema)
  .refine((d) => d.finalCalories !== undefined || (d.items?.length ?? 0) > 0, {
    message: 'Δώσε είτε συνολικές θερμίδες είτε τουλάχιστον ένα τρόφιμο.',
    path: ['finalCalories'],
  });

export type ManualMealInput = z.infer<typeof manualMealSchema>;

/** Απαντήσεις στις διευκρινιστικές ερωτήσεις του AI. */
export const clarificationAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1).max(60),
        answer: z.string().trim().min(1).max(120),
      }),
    )
    .min(1, 'Δώσε τουλάχιστον μία απάντηση.')
    .max(6),
});

export type ClarificationAnswersInput = z.infer<typeof clarificationAnswersSchema>;

export const confirmMealSchema = z.object({
  acknowledgeHighCalories: z.boolean().optional().default(false),
});

export const updateMealSchema = z
  .object({
    mealType: z.enum(MEAL_TYPES).optional(),
    title: z.string().trim().max(120).optional().or(z.literal('')),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
    mealDateTime: localDateTimeSchema.optional(),
    finalCalories: calorieField.optional(),
    items: z.array(mealItemSchema).max(30, 'Πάρα πολλά τρόφιμα.').optional(),
    /** Ρητή επιβεβαίωση όταν οι θερμίδες ξεπερνούν το soft limit. */
    acknowledgeHighCalories: z.boolean().optional().default(false),
  })
  .merge(macroFieldsSchema)
  .refine((d) => Object.keys(d).length > 0, { message: 'Δεν στάλθηκε καμία αλλαγή.' });

export type UpdateMealInput = z.infer<typeof updateMealSchema>;

export const mealHistoryQuerySchema = z.object({
  from: dayISOSchema.optional(),
  to: dayISOSchema.optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
  search: z.string().trim().max(80).optional(),
  minCalories: z.coerce.number().int().min(0).optional(),
  maxCalories: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Quick-pick / favorites (meal-history feature) ---

export const quickPickRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('favorite'), id: z.string().cuid() }),
  z.object({ kind: z.literal('frequent'), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ kind: z.literal('recent'), mealId: z.string().cuid() }),
]);

const servingMultiplier = z.coerce.number().positive().max(20);

export const quickPickPreviewSchema = z.object({
  ref: quickPickRefSchema,
  servingMultiplier: servingMultiplier.default(1),
});

export const quickPickCreateSchema = z.object({
  ref: quickPickRefSchema,
  servingMultiplier: servingMultiplier.default(1),
  mealType: z.enum(MEAL_TYPES),
  notes: z.string().trim().max(500).optional(),
  overrides: macroFieldsSchema.extend({ finalCalories: calorieField.optional() }).partial().optional(),
  requestKey: z.string().trim().min(8).max(64).optional(),
});

export const favoriteCreateSchema = z.object({ ref: quickPickRefSchema });

export type QuickPickPreviewInput = z.infer<typeof quickPickPreviewSchema>;
export type QuickPickCreateInput = z.infer<typeof quickPickCreateSchema>;

export const dayQuerySchema = z.object({
  date: dayISOSchema.optional(),
});
