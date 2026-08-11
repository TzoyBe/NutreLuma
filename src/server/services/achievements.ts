import 'server-only';
import { type AchievementCategory } from '@prisma/client';
import { prisma } from '../db/prisma';
import {
  ACHIEVEMENTS,
  badgeCodeFor,
  type AchievementDef,
  type AchievementMetric,
} from '@/lib/achievements-catalog';
import { countDistinctDays, longestConsecutiveStreak, milestonePercent } from '@/lib/milestone-progress';
import { toZonedDayISO } from '@/lib/dates';
import { toNumber } from '@/lib/utils';
import { COUNTED_MEAL_STATUS } from './meal';
import { getGoalForDay } from './goals';
import { getUserTimezone } from './profile';
import { createNotification } from './notifications';
import { awardBadge } from './badges';

export type UserMetrics = Record<AchievementMetric, number>;

export interface AchievementView extends AchievementDef {
  badgeCode: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export async function upsertAchievementCatalog(): Promise<void> {
  await prisma.$transaction(
    ACHIEVEMENTS.map((achievement, index) =>
      prisma.achievementDefinition.upsert({
        where: { code: achievement.code },
        create: {
          code: achievement.code,
          name: achievement.name,
          description: achievement.description,
          category: achievement.category as AchievementCategory,
          icon: achievement.icon,
          threshold: achievement.threshold,
          badgeCode: badgeCodeFor(achievement.code),
          sortOrder: index,
        },
        update: {
          name: achievement.name,
          description: achievement.description,
          category: achievement.category as AchievementCategory,
          icon: achievement.icon,
          threshold: achievement.threshold,
          badgeCode: badgeCodeFor(achievement.code),
          sortOrder: index,
        },
      }),
    ),
  );
}

async function mealMetrics(userId: string, timezone: string) {
  const meals = await prisma.meal.findMany({
    where: { userId, status: COUNTED_MEAL_STATUS },
    select: {
      mealDateTime: true,
      finalCalories: true,
      proteinGrams: true,
      source: true,
    },
  });
  const days = meals.map((meal) => toZonedDayISO(meal.mealDateTime, timezone));
  const byDay = new Map<string, { count: number; calories: number; protein: number }>();
  for (const meal of meals) {
    const day = toZonedDayISO(meal.mealDateTime, timezone);
    const bucket = byDay.get(day) ?? { count: 0, calories: 0, protein: 0 };
    bucket.count += 1;
    bucket.calories += meal.finalCalories ?? 0;
    bucket.protein += toNumber(meal.proteinGrams);
    byDay.set(day, bucket);
  }

  let calorieTargetDays = 0;
  let proteinTargetDays = 0;
  for (const [day, totals] of byDay) {
    const goal = await getGoalForDay(userId, day);
    if (goal.calorieTarget && totals.calories > 0 && totals.calories <= goal.calorieTarget) {
      calorieTargetDays += 1;
    }
    if (goal.proteinGrams && totals.protein >= goal.proteinGrams) proteinTargetDays += 1;
  }

  return {
    mealsLogged: meals.length,
    loggingStreakDays: longestConsecutiveStreak(days),
    fullLoggingDays: [...byDay.values()].filter((day) => day.count >= 3).length,
    calorieTargetDays,
    proteinTargetDays,
    quickPickMeals: meals.filter((meal) => meal.source === 'SAVED_MEAL').length,
  };
}

async function waterTargetDays(userId: string): Promise<number> {
  const rows = await prisma.waterEntry.findMany({
    where: { userId },
    select: { entryDate: true, volumeMl: true },
  });
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.entryDate.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + row.volumeMl);
  }

  let passing = 0;
  for (const [day, total] of byDay) {
    const goal = await getGoalForDay(userId, day);
    if (total >= goal.waterMl) passing += 1;
  }
  return passing;
}

async function weightMetrics(userId: string) {
  const entries = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { entryDate: 'asc' },
    select: { weightKg: true },
  });
  const first = entries[0] ? toNumber(entries[0].weightKg) : null;
  const latest = entries.at(-1) ? toNumber(entries.at(-1)!.weightKg) : null;
  const weightLostKg = first !== null && latest !== null ? Math.max(0, first - latest) : 0;

  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { targetWeightKg: true, currentWeightKg: true },
  });
  const targetWeightReached =
    profile?.targetWeightKg && profile.currentWeightKg
      ? toNumber(profile.currentWeightKg) <= toNumber(profile.targetWeightKg)
        ? 1
        : 0
      : 0;
  const goalProgressPercent =
    first !== null && profile?.targetWeightKg
      ? milestonePercent(first, latest ?? first, toNumber(profile.targetWeightKg))
      : 0;

  return { weightEntries: entries.length, weightLostKg, targetWeightReached, goalProgressPercent };
}

async function maintenanceMetrics(userId: string, timezone: string) {
  const profile = await prisma.maintenanceProfile.findUnique({ where: { userId } });
  if (!profile) {
    return {
      maintenanceActivated: 0,
      maintenanceDaysInRange: 0,
      maintenanceDurationDays: 0,
      stableWeeks: 0,
      maintenanceProteinDays: 0,
      maintenanceLoggingDays: 0,
    };
  }

  const lower = toNumber(profile.lowerBoundaryKg);
  const upper = toNumber(profile.upperBoundaryKg);
  const activatedISO = profile.activatedAt.toISOString().slice(0, 10);
  const activatedDate = new Date(`${activatedISO}T00:00:00.000Z`);
  const todayMs = Date.now();
  const durationDays = Math.max(
    0,
    Math.floor((todayMs - profile.activatedAt.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const weightRows = await prisma.weightEntry.findMany({
    where: { userId, entryDate: { gte: activatedDate } },
    select: { weightKg: true },
  });
  const daysInRange = weightRows.filter((r) => {
    const v = toNumber(r.weightKg);
    return v >= lower && v <= upper;
  }).length;

  const meals = await prisma.meal.findMany({
    where: { userId, status: COUNTED_MEAL_STATUS, mealDateTime: { gte: activatedDate } },
    select: { mealDateTime: true, proteinGrams: true },
  });
  const byDay = new Map<string, { protein: number }>();
  for (const meal of meals) {
    const day = toZonedDayISO(meal.mealDateTime, timezone);
    const bucket = byDay.get(day) ?? { protein: 0 };
    bucket.protein += toNumber(meal.proteinGrams);
    byDay.set(day, bucket);
  }
  let proteinDays = 0;
  for (const [day, totals] of byDay) {
    const goal = await getGoalForDay(userId, day);
    if (goal.proteinGrams && totals.protein >= goal.proteinGrams) proteinDays += 1;
  }

  return {
    maintenanceActivated: 1,
    maintenanceDaysInRange: daysInRange,
    maintenanceDurationDays: durationDays,
    stableWeeks: Math.floor(daysInRange / 7),
    maintenanceProteinDays: proteinDays,
    maintenanceLoggingDays: byDay.size,
  };
}

export async function computeUserAchievementMetrics(userId: string): Promise<UserMetrics> {
  const timezone = await getUserTimezone(userId);
  const [meals, weight, savedFavorites, waterDays, activityEntries, activityRows, milestones, maintenance] =
    await Promise.all([
      mealMetrics(userId, timezone),
      weightMetrics(userId),
      prisma.favoriteMeal.count({ where: { userId } }),
      waterTargetDays(userId),
      prisma.activityEntry.count({ where: { userId } }),
      prisma.activityEntry.findMany({ where: { userId }, select: { entryDate: true } }),
      prisma.milestone.findMany({
        where: { userId },
        select: { status: true, completedAt: true, endDate: true },
      }),
      maintenanceMetrics(userId, timezone),
    ]);

  const milestonesCompleted = milestones.filter((m) => m.status === 'COMPLETED').length;
  const milestoneBeforeDeadline = milestones.some(
    (m) => m.status === 'COMPLETED' && m.completedAt && m.endDate && m.completedAt <= m.endDate,
  )
    ? 1
    : 0;

  return {
    mealsLogged: meals.mealsLogged,
    loggingStreakDays: meals.loggingStreakDays,
    fullLoggingDays: meals.fullLoggingDays,
    weightEntries: weight.weightEntries,
    weightLostKg: weight.weightLostKg,
    goalProgressPercent: weight.goalProgressPercent,
    targetWeightReached: weight.targetWeightReached,
    proteinTargetDays: meals.proteinTargetDays,
    calorieTargetDays: meals.calorieTargetDays,
    savedFavorites,
    quickPickMeals: meals.quickPickMeals,
    waterTargetDays: waterDays,
    activityEntries,
    activeDays: countDistinctDays(
      activityRows.map((row) => row.entryDate.toISOString().slice(0, 10)),
    ),
    milestonesCreated: milestones.length,
    milestonesCompleted,
    milestoneBeforeDeadline,
    ...maintenance,
  };
}

export async function evaluateAchievementsForUser(userId: string): Promise<AchievementView[]> {
  await upsertAchievementCatalog();
  const metrics = await computeUserAchievementMetrics(userId);
  const unlockedRows = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementCode: true, unlockedAt: true },
  });
  const unlocked = new Map(unlockedRows.map((row) => [row.achievementCode, row.unlockedAt]));

  for (const achievement of ACHIEVEMENTS) {
    if ((metrics[achievement.metric] ?? 0) < achievement.threshold) continue;
    if (unlocked.has(achievement.code)) continue;

    const row = await prisma.userAchievement.create({
      data: { userId, achievementCode: achievement.code },
    });
    unlocked.set(achievement.code, row.unlockedAt);
    await createNotification(userId, {
      type: 'ACHIEVEMENT_UNLOCKED',
      title: achievement.name,
      body: achievement.description,
      dedupeKey: `achievement:${achievement.code}`,
    });
    await awardBadge(userId, badgeCodeFor(achievement.code), { notify: false });
  }

  return listAchievements(userId);
}

export async function listAchievements(userId: string): Promise<AchievementView[]> {
  const unlockedRows = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementCode: true, unlockedAt: true },
  });
  const unlocked = new Map(unlockedRows.map((row) => [row.achievementCode, row.unlockedAt]));
  return ACHIEVEMENTS.map((achievement) => {
    const unlockedAt = unlocked.get(achievement.code) ?? null;
    return {
      ...achievement,
      badgeCode: badgeCodeFor(achievement.code),
      unlocked: unlockedAt !== null,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
    };
  });
}
