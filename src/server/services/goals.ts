import 'server-only';
import { Prisma, type GoalSource } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { logger } from '../logger';
import { ApiError } from '../errors';
import { suggestDailyCalorieTarget } from '@/lib/calories';
import { suggestMacroTargets } from '@/lib/nutrition';
import { toNumber } from '@/lib/utils';
import type { SetGoalInput } from '@/lib/validation/goals';

export interface GoalView {
  id: string | null;
  effectiveFrom: string | null;
  source: GoalSource;
  calorieTarget: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  waterMl: number;
  /** true όταν ο στόχος δεν προέρχεται από αποθηκευμένη εγγραφή ιστορικού. */
  isFallback: boolean;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dec(value: number | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined ? null : new Prisma.Decimal(value.toFixed(2));
}

/**
 * Ο στόχος που ίσχυε μια συγκεκριμένη ημέρα: η πιο πρόσφατη εγγραφή με
 * `effectiveFrom <= ημέρα`. Έτσι αλλαγή του σημερινού στόχου ΔΕΝ αλλοιώνει
 * αναδρομικά παλιές αναφορές.
 *
 * Fallback (μόνο όταν δεν υπάρχει καμία εγγραφή ιστορικού): το πεδίο
 * `dailyCalorieTarget` του προφίλ, ώστε λογαριασμοί που δεν έχουν ακόμη
 * περάσει από τη νέα οθόνη στόχων να συνεχίσουν να λειτουργούν.
 */
export async function getGoalForDay(userId: string, dayISO: string): Promise<GoalView> {
  const row = await prisma.nutritionGoal.findFirst({
    where: { userId, effectiveFrom: { lte: toDateOnly(dayISO) } },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (row) {
    return {
      id: row.id,
      effectiveFrom: toIsoDay(row.effectiveFrom),
      source: row.source,
      calorieTarget: row.calorieTarget,
      proteinGrams: row.proteinGrams === null ? null : toNumber(row.proteinGrams),
      carbohydrateGrams:
        row.carbohydrateGrams === null ? null : toNumber(row.carbohydrateGrams),
      fatGrams: row.fatGrams === null ? null : toNumber(row.fatGrams),
      fiberGrams: row.fiberGrams === null ? null : toNumber(row.fiberGrams),
      waterMl: row.waterMl ?? env.DEFAULT_DAILY_WATER_TARGET_ML,
      isFallback: false,
    };
  }

  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { dailyCalorieTarget: true },
  });

  return {
    id: null,
    effectiveFrom: null,
    source: 'AUTO',
    calorieTarget: profile?.dailyCalorieTarget ?? null,
    proteinGrams: null,
    carbohydrateGrams: null,
    fatGrams: null,
    fiberGrams: null,
    waterMl: env.DEFAULT_DAILY_WATER_TARGET_ML,
    isFallback: true,
  };
}

export interface GoalSuggestion {
  calorieTarget: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  waterMl: number;
}

/**
 * Προτεινόμενοι στόχοι από το προφίλ υγείας. Οι θερμίδες περνούν ήδη από
 * λογικά κάτω/άνω όρια στο `suggestDailyCalorieTarget`.
 */
export async function suggestGoals(userId: string): Promise<GoalSuggestion | null> {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const calorieTarget = suggestDailyCalorieTarget({
    gender: profile.gender,
    heightCm: toNumber(profile.heightCm),
    weightKg: toNumber(profile.currentWeightKg),
    birthDate: profile.birthDate,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
  });

  return {
    calorieTarget,
    ...suggestMacroTargets(calorieTarget, profile.goal),
    waterMl: env.DEFAULT_DAILY_WATER_TARGET_ML,
  };
}

/**
 * Ορίζει τον στόχο από μια ημερομηνία και μετά. Δεύτερη αλλαγή την ίδια ημέρα
 * αντικαθιστά την εγγραφή αντί να δημιουργεί δεύτερη — το ιστορικό κρατά μία
 * τιμή ανά ημέρα, που είναι και το νόημα του `effectiveFrom`.
 */
export async function setGoal(
  userId: string,
  input: SetGoalInput,
  todayISO: string,
): Promise<GoalView> {
  const effectiveFromISO = input.effectiveFrom ?? todayISO;
  if (effectiveFromISO > todayISO) {
    throw new ApiError('VALIDATION_ERROR', 'Ο στόχος δεν μπορεί να ξεκινά στο μέλλον.');
  }

  const effectiveFrom = toDateOnly(effectiveFromISO);
  const data = {
    source: input.source ?? 'MANUAL',
    calorieTarget: input.calorieTarget,
    proteinGrams: dec(input.proteinGrams),
    carbohydrateGrams: dec(input.carbohydrateGrams),
    fatGrams: dec(input.fatGrams),
    fiberGrams: dec(input.fiberGrams),
    waterMl: input.waterMl ?? null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.nutritionGoal.upsert({
      where: { userId_effectiveFrom: { userId, effectiveFrom } },
      create: { userId, effectiveFrom, ...data },
      update: data,
    });
    // Το παλιό πεδίο του προφίλ μένει συγχρονισμένο ώστε κώδικας που δεν έχει
    // ακόμη μεταφερθεί στους νέους στόχους να μη βλέπει ξεπερασμένη τιμή.
    await tx.healthProfile.updateMany({
      where: { userId },
      data: { dailyCalorieTarget: input.calorieTarget },
    });
  });

  logger.info('nutrition_goal_set', { userId, effectiveFrom: effectiveFromISO });
  return getGoalForDay(userId, todayISO);
}

export interface GoalHistoryEntry {
  id: string;
  effectiveFrom: string;
  source: GoalSource;
  calorieTarget: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  waterMl: number | null;
}

export async function listGoalHistory(userId: string, limit = 50): Promise<GoalHistoryEntry[]> {
  const rows = await prisma.nutritionGoal.findMany({
    where: { userId },
    orderBy: { effectiveFrom: 'desc' },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    effectiveFrom: toIsoDay(row.effectiveFrom),
    source: row.source,
    calorieTarget: row.calorieTarget,
    proteinGrams: row.proteinGrams === null ? null : toNumber(row.proteinGrams),
    carbohydrateGrams: row.carbohydrateGrams === null ? null : toNumber(row.carbohydrateGrams),
    fatGrams: row.fatGrams === null ? null : toNumber(row.fatGrams),
    fiberGrams: row.fiberGrams === null ? null : toNumber(row.fiberGrams),
    waterMl: row.waterMl,
  }));
}
