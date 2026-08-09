import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { suggestDailyCalorieTarget } from '@/lib/calories';
import { suggestMacroTargets } from '@/lib/nutrition';
import { toNumber } from '@/lib/utils';
import type { HealthProfileInput } from '@/lib/validation/profile';

export interface ProfileView {
  id: string;
  firstName: string;
  lastName: string | null;
  birthDate: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number | null;
  activityLevel: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
  goal: 'LOSE' | 'MAINTAIN' | 'GAIN';
  dailyCalorieTarget: number | null;
  suggestedDailyCalorieTarget: number;
  effectiveDailyCalorieTarget: number;
  preferredUnits: 'METRIC' | 'IMPERIAL';
  timezone: string;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getProfile(userId: string): Promise<ProfileView | null> {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const suggested = suggestDailyCalorieTarget({
    gender: profile.gender,
    heightCm: toNumber(profile.heightCm),
    weightKg: toNumber(profile.currentWeightKg),
    birthDate: profile.birthDate,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
  });

  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthDate: toIsoDay(profile.birthDate),
    gender: profile.gender,
    heightCm: toNumber(profile.heightCm),
    currentWeightKg: toNumber(profile.currentWeightKg),
    targetWeightKg: profile.targetWeightKg === null ? null : toNumber(profile.targetWeightKg),
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    dailyCalorieTarget: profile.dailyCalorieTarget,
    suggestedDailyCalorieTarget: suggested,
    effectiveDailyCalorieTarget: profile.dailyCalorieTarget ?? suggested,
    preferredUnits: profile.preferredUnits,
    timezone: profile.timezone,
  };
}

/** Το timezone του χρήστη· fallback στην προεπιλογή της εγκατάστασης. */
export async function getUserTimezone(userId: string): Promise<string> {
  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? env.DEFAULT_TIMEZONE;
}

export async function getUserTargetAndTimezone(
  userId: string,
): Promise<{ timezone: string; target: number | null }> {
  const profile = await getProfile(userId);
  if (!profile) return { timezone: env.DEFAULT_TIMEZONE, target: null };
  return { timezone: profile.timezone, target: profile.effectiveDailyCalorieTarget };
}

/**
 * Δημιουργεί ή ενημερώνει το προφίλ υγείας.
 * Ταυτόχρονα καταγράφει το τρέχον βάρος ως εγγραφή βάρους της ημέρας, ώστε το
 * ιστορικό να παραμένει συνεπές με το προφίλ (μία transaction).
 */
export async function upsertProfile(
  userId: string,
  input: HealthProfileInput,
  todayISO: string,
): Promise<ProfileView> {
  const data = {
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    birthDate: toDateOnly(input.birthDate),
    gender: input.gender,
    heightCm: new Prisma.Decimal(input.heightCm.toFixed(2)),
    currentWeightKg: new Prisma.Decimal(input.currentWeightKg.toFixed(2)),
    targetWeightKg:
      input.targetWeightKg === undefined
        ? null
        : new Prisma.Decimal(Number(input.targetWeightKg).toFixed(2)),
    activityLevel: input.activityLevel,
    goal: input.goal,
    dailyCalorieTarget: input.dailyCalorieTarget ?? null,
    preferredUnits: input.preferredUnits,
    timezone: input.timezone,
  };

  const suggestedTarget = suggestDailyCalorieTarget({
    gender: input.gender,
    heightCm: input.heightCm,
    weightKg: input.currentWeightKg,
    birthDate: toDateOnly(input.birthDate),
    activityLevel: input.activityLevel,
    goal: input.goal,
  });
  const effectiveTarget = input.dailyCalorieTarget ?? suggestedTarget;
  const suggestedMacros = suggestMacroTargets(effectiveTarget, input.goal);
  const effectiveFrom = toDateOnly(todayISO);

  await prisma.$transaction(async (tx) => {
    await tx.healthProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    await tx.weightEntry.upsert({
      where: { userId_entryDate: { userId, entryDate: toDateOnly(todayISO) } },
      create: {
        userId,
        entryDate: toDateOnly(todayISO),
        weightKg: data.currentWeightKg,
      },
      update: { weightKg: data.currentWeightKg },
    });

    // Ο στόχος του προφίλ γίνεται εγγραφή στο ιστορικό στόχων, από σήμερα.
    // Τυχόν macros που έχει ήδη ορίσει ο χρήστης για σήμερα ΔΕΝ χάνονται —
    // αντικαθίστανται μόνο αν δεν υπάρχουν.
    const existing = await tx.nutritionGoal.findUnique({
      where: { userId_effectiveFrom: { userId, effectiveFrom } },
      select: { proteinGrams: true, carbohydrateGrams: true, fatGrams: true, fiberGrams: true },
    });

    await tx.nutritionGoal.upsert({
      where: { userId_effectiveFrom: { userId, effectiveFrom } },
      create: {
        userId,
        effectiveFrom,
        source: input.dailyCalorieTarget ? 'MANUAL' : 'AUTO',
        calorieTarget: effectiveTarget,
        proteinGrams: new Prisma.Decimal(suggestedMacros.proteinGrams),
        carbohydrateGrams: new Prisma.Decimal(suggestedMacros.carbohydrateGrams),
        fatGrams: new Prisma.Decimal(suggestedMacros.fatGrams),
        fiberGrams: new Prisma.Decimal(suggestedMacros.fiberGrams),
      },
      update: {
        source: input.dailyCalorieTarget ? 'MANUAL' : 'AUTO',
        calorieTarget: effectiveTarget,
        proteinGrams: existing?.proteinGrams ?? new Prisma.Decimal(suggestedMacros.proteinGrams),
        carbohydrateGrams:
          existing?.carbohydrateGrams ?? new Prisma.Decimal(suggestedMacros.carbohydrateGrams),
        fatGrams: existing?.fatGrams ?? new Prisma.Decimal(suggestedMacros.fatGrams),
        fiberGrams: existing?.fiberGrams ?? new Prisma.Decimal(suggestedMacros.fiberGrams),
      },
    });
  });

  const profile = await getProfile(userId);
  // Το προφίλ μόλις γράφτηκε στην ίδια transaction, οπότε υπάρχει σίγουρα.
  return profile as ProfileView;
}
