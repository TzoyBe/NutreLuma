import 'server-only';
import { prisma } from '../db/prisma';
import { getStorage } from '../storage';
import { verifyPassword } from '../auth/password';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { toNumber } from '@/lib/utils';

export interface ExportBundle {
  exportedAt: string;
  account: { email: string; displayName: string; createdAt: string };
  healthProfile: Record<string, unknown> | null;
  nutritionGoals: Array<Record<string, unknown>>;
  meals: Array<Record<string, unknown>>;
  weightEntries: Array<Record<string, unknown>>;
  disclaimer: string;
}

/** Τα macros ενός γεύματος ή τροφίμου, σε μορφή κατάλληλη για export. */
function macrosForExport(row: {
  proteinGrams: unknown;
  carbohydrateGrams: unknown;
  fatGrams: unknown;
  fiberGrams: unknown;
  sugarGrams: unknown;
  saturatedFatGrams: unknown;
  sodiumMg: number | null;
}): Record<string, number | null> {
  const dec = (value: unknown) => (value === null || value === undefined ? null : toNumber(value));
  return {
    proteinGrams: dec(row.proteinGrams),
    carbohydrateGrams: dec(row.carbohydrateGrams),
    fatGrams: dec(row.fatGrams),
    fiberGrams: dec(row.fiberGrams),
    sugarGrams: dec(row.sugarGrams),
    saturatedFatGrams: dec(row.saturatedFatGrams),
    sodiumMg: row.sodiumMg,
  };
}

const DISCLAIMER =
  'Οι θερμίδες αποτελούν εκτίμηση βάσει φωτογραφίας και ενδέχεται να μην είναι ακριβείς. Δεν αποτελούν ιατρική ή διατροφική διάγνωση.';

/** Πλήρης εξαγωγή των δεδομένων του χρήστη (GDPR portability). */
export async function exportUserData(userId: string): Promise<ExportBundle> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, createdAt: true },
  });
  if (!user) throw new ApiError('NOT_FOUND', 'Ο λογαριασμός δεν βρέθηκε.');

  const [profile, goals, meals, weights] = await Promise.all([
    prisma.healthProfile.findUnique({ where: { userId } }),
    prisma.nutritionGoal.findMany({ where: { userId }, orderBy: { effectiveFrom: 'asc' } }),
    prisma.meal.findMany({
      where: { userId },
      orderBy: { mealDateTime: 'asc' },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        clarifications: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { entryDate: 'asc' } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    },
    healthProfile: profile
      ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          birthDate: profile.birthDate.toISOString().slice(0, 10),
          gender: profile.gender,
          heightCm: toNumber(profile.heightCm),
          currentWeightKg: toNumber(profile.currentWeightKg),
          targetWeightKg: profile.targetWeightKg ? toNumber(profile.targetWeightKg) : null,
          activityLevel: profile.activityLevel,
          goal: profile.goal,
          dailyCalorieTarget: profile.dailyCalorieTarget,
          preferredUnits: profile.preferredUnits,
          timezone: profile.timezone,
        }
      : null,
    nutritionGoals: goals.map((goal) => ({
      effectiveFrom: goal.effectiveFrom.toISOString().slice(0, 10),
      source: goal.source,
      calorieTarget: goal.calorieTarget,
      proteinGrams: goal.proteinGrams === null ? null : toNumber(goal.proteinGrams),
      carbohydrateGrams:
        goal.carbohydrateGrams === null ? null : toNumber(goal.carbohydrateGrams),
      fatGrams: goal.fatGrams === null ? null : toNumber(goal.fatGrams),
      fiberGrams: goal.fiberGrams === null ? null : toNumber(goal.fiberGrams),
      waterMl: goal.waterMl,
    })),
    meals: meals.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      title: meal.title,
      notes: meal.notes,
      mealDateTimeUtc: meal.mealDateTime.toISOString(),
      status: meal.status,
      source: meal.source,
      confirmedAt: meal.confirmedAt ? meal.confirmedAt.toISOString() : null,
      aiEstimatedCalories: meal.aiEstimatedCalories,
      finalCalories: meal.finalCalories,
      aiMinCalories: meal.aiMinCalories,
      aiMaxCalories: meal.aiMaxCalories,
      aiConfidence: meal.aiConfidence,
      aiModel: meal.aiModel,
      analysisStatus: meal.analysisStatus,
      wasManuallyEdited: meal.wasManuallyEdited,
      createdAt: meal.createdAt.toISOString(),
      macros: macrosForExport(meal),
      items: meal.items.map((item) => ({
        name: item.name,
        estimatedQuantity: item.estimatedQuantity,
        aiEstimatedCalories: item.aiEstimatedCalories,
        finalCalories: item.finalCalories,
        aiMinCalories: item.aiMinCalories,
        aiMaxCalories: item.aiMaxCalories,
        macros: macrosForExport(item),
      })),
      clarifications: meal.clarifications.map((c) => ({
        question: c.question,
        answer: c.answer,
        answeredAt: c.answeredAt ? c.answeredAt.toISOString() : null,
      })),
    })),
    weightEntries: weights.map((entry) => ({
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      weightKg: toNumber(entry.weightKg),
      notes: entry.notes,
    })),
    disclaimer: DISCLAIMER,
  };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Αποτροπή CSV injection σε Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportToCsv(bundle: ExportBundle): string {
  const lines: string[] = [];
  lines.push(
    [
      'type',
      'date',
      'mealType',
      'title',
      'aiCalories',
      'finalCalories',
      'manuallyEdited',
      'status',
      'source',
      'proteinGrams',
      'carbohydrateGrams',
      'fatGrams',
      'fiberGrams',
      'itemsOrWeight',
      'notes',
    ]
      .map(csvCell)
      .join(','),
  );

  const emptyMacros = { proteinGrams: null, carbohydrateGrams: null, fatGrams: null, fiberGrams: null };

  for (const meal of bundle.meals) {
    const items = (meal.items as Array<{ name: string; finalCalories: number | null }>)
      .map((item) => `${item.name} (${item.finalCalories ?? 0} kcal)`)
      .join(' | ');
    const macros = (meal.macros as typeof emptyMacros | undefined) ?? emptyMacros;
    lines.push(
      [
        'meal',
        meal.mealDateTimeUtc,
        meal.mealType,
        meal.title ?? '',
        meal.aiEstimatedCalories ?? '',
        meal.finalCalories ?? '',
        meal.wasManuallyEdited ? 'yes' : 'no',
        meal.status ?? '',
        meal.source ?? '',
        macros.proteinGrams ?? '',
        macros.carbohydrateGrams ?? '',
        macros.fatGrams ?? '',
        macros.fiberGrams ?? '',
        items,
        meal.notes ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  for (const goal of bundle.nutritionGoals) {
    lines.push(
      [
        'goal',
        goal.effectiveFrom,
        '',
        '',
        '',
        goal.calorieTarget ?? '',
        goal.source === 'MANUAL' ? 'yes' : 'no',
        '',
        '',
        goal.proteinGrams ?? '',
        goal.carbohydrateGrams ?? '',
        goal.fatGrams ?? '',
        goal.fiberGrams ?? '',
        goal.waterMl ? `${goal.waterMl} ml` : '',
        '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  for (const entry of bundle.weightEntries) {
    lines.push(
      [
        'weight',
        entry.entryDate,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `${entry.weightKg} kg`,
        entry.notes ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return `﻿${lines.join('\r\n')}\r\n`;
}

/**
 * Οριστική διαγραφή λογαριασμού: πρώτα τα αρχεία, μετά η εγγραφή χρήστη
 * (cascade διαγράφει profile, meals, items, weight entries, ai logs).
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new ApiError('NOT_FOUND', 'Ο λογαριασμός δεν βρέθηκε.');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new ApiError('FORBIDDEN', 'Ο κωδικός δεν είναι σωστός.');

  const meals = await prisma.meal.findMany({
    where: { userId },
    select: { imagePath: true, thumbPath: true },
  });

  const storage = getStorage();
  for (const meal of meals) {
    if (meal.imagePath) await storage.delete(meal.imagePath);
    if (meal.thumbPath) await storage.delete(meal.thumbPath);
  }

  await prisma.user.delete({ where: { id: userId } });
  logger.info('account_deleted', { userId, deletedImages: meals.length });
}
