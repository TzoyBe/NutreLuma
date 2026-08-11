import 'server-only';
import { Prisma, type Milestone, type MilestoneType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { addDaysISO, dayRangeList, toZonedDayISO, zonedDayRangeUtc } from '@/lib/dates';
import {
  countDistinctDays,
  isWeightGoalReached,
  longestConsecutiveStreak,
  milestonePercent,
  resolveWeightCurrent,
  type WeightDirection,
  type WeightPoint,
} from '@/lib/milestone-progress';
import { toNumber } from '@/lib/utils';
import { COUNTED_MEAL_STATUS } from './meal';
import { getGoalForDay } from './goals';
import { getUserTimezone } from './profile';
import { activeDays, stepsByDay } from './activity';
import { waterMlByDay } from './water';
import { createNotification } from './notifications';

const COUNT_TYPES = new Set<MilestoneType>([
  'MEAL_LOGGING_DAYS',
  'WEIGH_IN_FREQUENCY',
  'CALORIE_TARGET_DAYS',
  'PROTEIN_TARGET_DAYS',
  'WATER_TARGET_DAYS',
  'STEP_TARGET_DAYS',
  'ACTIVITY_TARGET',
]);

export interface ComputedMilestoneProgress {
  milestoneId: string;
  type: MilestoneType;
  currentValue: number;
  targetValue: number;
  percent: number;
  method: string;
  completed: boolean;
  missed: boolean;
}

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function toDayISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayForWindow(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function dec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function windowEnd(milestone: Pick<Milestone, 'endDate'>, now: Date): string {
  const today = todayForWindow(now);
  const end = milestone.endDate ? toDayISO(milestone.endDate) : today;
  return end < today ? end : today;
}

function isPastEnd(milestone: Pick<Milestone, 'endDate'>, now: Date): boolean {
  return Boolean(milestone.endDate && toDayISO(milestone.endDate) < todayForWindow(now));
}

function startValueOf(milestone: Pick<Milestone, 'startValue'>): number {
  return milestone.startValue === null ? 0 : toNumber(milestone.startValue);
}

function targetValueOf(milestone: Pick<Milestone, 'targetValue'>): number {
  return toNumber(milestone.targetValue);
}

async function weightPoints(userId: string, fromISO: string, toISO: string): Promise<WeightPoint[]> {
  const rows = await prisma.weightEntry.findMany({
    where: {
      userId,
      entryDate: { gte: toDateOnly(fromISO), lte: toDateOnly(toISO) },
    },
    orderBy: { entryDate: 'asc' },
    select: { entryDate: true, weightKg: true },
  });
  return rows.map((row) => ({ date: toDayISO(row.entryDate), value: toNumber(row.weightKg) }));
}

async function weightBaseline(userId: string, startISO: string): Promise<number | null> {
  const row = await prisma.weightEntry.findFirst({
    where: { userId, entryDate: { lte: toDateOnly(startISO) } },
    orderBy: { entryDate: 'desc' },
    select: { weightKg: true },
  });
  return row ? toNumber(row.weightKg) : null;
}

function weightTargetFor(milestone: Milestone, baseline: number): {
  absoluteTarget: number;
  direction: WeightDirection;
  startForPercent: number;
  targetForPercent: number;
} {
  const target = targetValueOf(milestone);
  if (milestone.type === 'TARGET_WEIGHT') {
    return {
      absoluteTarget: target,
      direction: target <= baseline ? 'loss' : 'gain',
      startForPercent: baseline,
      targetForPercent: target,
    };
  }
  if (milestone.type === 'WEIGHT_GAIN_AMOUNT') {
    return {
      absoluteTarget: baseline + target,
      direction: 'gain',
      startForPercent: 0,
      targetForPercent: target,
    };
  }
  return {
    absoluteTarget: baseline - target,
    direction: 'loss',
    startForPercent: 0,
    targetForPercent: target,
  };
}

async function computeWeightMilestone(
  userId: string,
  milestone: Milestone,
  now: Date,
): Promise<ComputedMilestoneProgress> {
  const startISO = toDayISO(milestone.startDate);
  const toISO = windowEnd(milestone, now);
  const baseline = milestone.startValue === null
    ? await weightBaseline(userId, startISO)
    : toNumber(milestone.startValue);
  const targetValue = targetValueOf(milestone);

  if (baseline === null) {
    return {
      milestoneId: milestone.id,
      type: milestone.type,
      currentValue: 0,
      targetValue,
      percent: 0,
      method: 'no_weight_baseline',
      completed: false,
      missed: isPastEnd(milestone, now),
    };
  }

  const points = await weightPoints(userId, startISO, toISO);
  const current = resolveWeightCurrent(points);
  const target = weightTargetFor(milestone, baseline);
  const reached = isWeightGoalReached(points, target.absoluteTarget, target.direction);
  const latestWeight = current?.value ?? baseline;
  const currentValue =
    milestone.type === 'TARGET_WEIGHT'
      ? latestWeight
      : Math.max(
          0,
          target.direction === 'loss' ? baseline - latestWeight : latestWeight - baseline,
        );
  const percent = milestonePercent(target.startForPercent, currentValue, target.targetForPercent);
  return {
    milestoneId: milestone.id,
    type: milestone.type,
    currentValue,
    targetValue: target.targetForPercent,
    percent,
    method: reached.method === 'no_data' ? current?.method ?? 'no_data' : reached.method,
    completed: reached.reached,
    missed: !reached.reached && isPastEnd(milestone, now),
  };
}

async function mealDays(
  userId: string,
  fromISO: string,
  toISO: string,
  timezone: string,
): Promise<string[]> {
  const start = zonedDayRangeUtc(fromISO, timezone).start;
  const end = zonedDayRangeUtc(addDaysISO(toISO, 1), timezone).start;
  const rows = await prisma.meal.findMany({
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      finalCalories: { not: null },
      status: COUNTED_MEAL_STATUS,
    },
    select: { mealDateTime: true },
  });
  return rows.map((row) => toZonedDayISO(row.mealDateTime, timezone));
}

async function weighInDays(userId: string, fromISO: string, toISO: string): Promise<string[]> {
  const rows = await prisma.weightEntry.findMany({
    where: { userId, entryDate: { gte: toDateOnly(fromISO), lte: toDateOnly(toISO) } },
    select: { entryDate: true },
  });
  return rows.map((row) => toDayISO(row.entryDate));
}

async function calorieTargetDays(
  userId: string,
  fromISO: string,
  toISO: string,
  timezone: string,
): Promise<string[]> {
  const totals = new Map<string, number>();
  for (const day of dayRangeList(fromISO, toISO)) totals.set(day, 0);

  const start = zonedDayRangeUtc(fromISO, timezone).start;
  const end = zonedDayRangeUtc(addDaysISO(toISO, 1), timezone).start;
  const rows = await prisma.meal.findMany({
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      finalCalories: { not: null },
      status: COUNTED_MEAL_STATUS,
    },
    select: { mealDateTime: true, finalCalories: true },
  });
  for (const row of rows) {
    const day = toZonedDayISO(row.mealDateTime, timezone);
    totals.set(day, (totals.get(day) ?? 0) + (row.finalCalories ?? 0));
  }

  const passing: string[] = [];
  for (const [day, total] of totals) {
    const target = (await getGoalForDay(userId, day)).calorieTarget;
    if (target && total > 0 && total <= target) passing.push(day);
  }
  return passing;
}

async function proteinTargetDays(
  userId: string,
  fromISO: string,
  toISO: string,
  timezone: string,
): Promise<string[]> {
  const totals = new Map<string, number>();
  for (const day of dayRangeList(fromISO, toISO)) totals.set(day, 0);

  const start = zonedDayRangeUtc(fromISO, timezone).start;
  const end = zonedDayRangeUtc(addDaysISO(toISO, 1), timezone).start;
  const rows = await prisma.meal.findMany({
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      status: COUNTED_MEAL_STATUS,
    },
    select: { mealDateTime: true, proteinGrams: true },
  });
  for (const row of rows) {
    const day = toZonedDayISO(row.mealDateTime, timezone);
    totals.set(day, (totals.get(day) ?? 0) + toNumber(row.proteinGrams));
  }

  const passing: string[] = [];
  for (const [day, total] of totals) {
    const target = (await getGoalForDay(userId, day)).proteinGrams;
    if (target && total >= target) passing.push(day);
  }
  return passing;
}

async function waterTargetDays(userId: string, fromISO: string, toISO: string): Promise<string[]> {
  const totals = await waterMlByDay(userId, fromISO, toISO);
  const passing: string[] = [];
  for (const day of dayRangeList(fromISO, toISO)) {
    const target = (await getGoalForDay(userId, day)).waterMl;
    if ((totals.get(day) ?? 0) >= target) passing.push(day);
  }
  return passing;
}

async function stepTargetDays(
  userId: string,
  fromISO: string,
  toISO: string,
  threshold: number,
): Promise<string[]> {
  const totals = await stepsByDay(userId, fromISO, toISO);
  return dayRangeList(fromISO, toISO).filter((day) => (totals.get(day) ?? 0) >= threshold);
}

async function countDaysForType(
  userId: string,
  milestone: Milestone,
  toISO: string,
  timezone: string,
): Promise<{ days: string[]; method: string }> {
  const fromISO = toDayISO(milestone.startDate);
  switch (milestone.type) {
    case 'MEAL_LOGGING_DAYS':
      return { days: await mealDays(userId, fromISO, toISO, timezone), method: 'meal_logging_days' };
    case 'WEIGH_IN_FREQUENCY':
      return { days: await weighInDays(userId, fromISO, toISO), method: 'weigh_in_days' };
    case 'CALORIE_TARGET_DAYS':
      return {
        days: await calorieTargetDays(userId, fromISO, toISO, timezone),
        method: 'calorie_target_days',
      };
    case 'PROTEIN_TARGET_DAYS':
      return {
        days: await proteinTargetDays(userId, fromISO, toISO, timezone),
        method: 'protein_target_days',
      };
    case 'WATER_TARGET_DAYS':
      return { days: await waterTargetDays(userId, fromISO, toISO), method: 'water_target_days' };
    case 'STEP_TARGET_DAYS':
      return {
        days: await stepTargetDays(userId, fromISO, toISO, toNumber(milestone.dailyThreshold)),
        method: 'step_target_days',
      };
    case 'ACTIVITY_TARGET':
      return { days: await activeDays(userId, fromISO, toISO), method: 'activity_days' };
    default:
      return { days: [], method: 'unsupported' };
  }
}

async function computeCountMilestone(
  userId: string,
  milestone: Milestone,
  now: Date,
  timezone: string,
): Promise<ComputedMilestoneProgress> {
  const toISO = windowEnd(milestone, now);
  const targetValue = targetValueOf(milestone);

  if (milestone.type === 'MEAL_LOGGING_STREAK') {
    const days = await mealDays(userId, toDayISO(milestone.startDate), toISO, timezone);
    const currentValue = longestConsecutiveStreak(days);
    return {
      milestoneId: milestone.id,
      type: milestone.type,
      currentValue,
      targetValue,
      percent: milestonePercent(0, currentValue, targetValue),
      method: 'meal_logging_streak',
      completed: currentValue >= targetValue,
      missed: currentValue < targetValue && isPastEnd(milestone, now),
    };
  }

  const { days, method } = await countDaysForType(userId, milestone, toISO, timezone);
  const currentValue = countDistinctDays(days);
  return {
    milestoneId: milestone.id,
    type: milestone.type,
    currentValue,
    targetValue,
    percent: milestonePercent(0, currentValue, targetValue),
    method,
    completed: currentValue >= targetValue,
    missed: currentValue < targetValue && isPastEnd(milestone, now),
  };
}

export async function computeMilestoneProgress(
  userId: string,
  milestone: Milestone,
  now = new Date(),
): Promise<ComputedMilestoneProgress> {
  if (milestone.userId !== userId) {
    throw new ApiError('NOT_FOUND', 'Milestone not found.');
  }
  const timezone = await getUserTimezone(userId);
  if (
    milestone.type === 'TARGET_WEIGHT' ||
    milestone.type === 'WEIGHT_LOSS_AMOUNT' ||
    milestone.type === 'WEIGHT_GAIN_AMOUNT'
  ) {
    return computeWeightMilestone(userId, milestone, now);
  }
  if (milestone.type === 'MEAL_LOGGING_STREAK' || COUNT_TYPES.has(milestone.type)) {
    return computeCountMilestone(userId, milestone, now, timezone);
  }

  const currentValue = toNumber(milestone.currentValue);
  const targetValue = targetValueOf(milestone);
  return {
    milestoneId: milestone.id,
    type: milestone.type,
    currentValue,
    targetValue,
    percent: milestonePercent(startValueOf(milestone), currentValue, targetValue),
    method: milestone.progressMethod ?? 'custom_numeric',
    completed: currentValue >= targetValue,
    missed: currentValue < targetValue && isPastEnd(milestone, now),
  };
}

async function persistComputedProgress(
  milestone: Milestone,
  computed: ComputedMilestoneProgress,
): Promise<void> {
  const status = computed.completed ? 'COMPLETED' : computed.missed ? 'MISSED' : milestone.status;
  await prisma.$transaction([
    prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        currentValue: dec(computed.currentValue),
        progressMethod: computed.method,
        status,
        completedAt:
          computed.completed && milestone.completedAt === null ? new Date() : milestone.completedAt,
      },
    }),
    prisma.milestoneProgress.create({
      data: {
        milestoneId: milestone.id,
        value: dec(computed.currentValue),
        method: computed.method,
      },
    }),
  ]);

  await createProgressNotifications(milestone, computed);
}

async function createProgressNotifications(
  milestone: Milestone,
  computed: ComputedMilestoneProgress,
): Promise<void> {
  for (const threshold of [25, 50, 75, 100]) {
    if (computed.percent < threshold) continue;
    await createNotification(milestone.userId, {
      type: 'MILESTONE_PROGRESS',
      title: `${threshold}% ${milestone.title}`,
      body: `You reached ${threshold}% of this milestone.`,
      milestoneId: milestone.id,
      dedupeKey: `milestone:${milestone.id}:progress:${threshold}`,
    });
  }
  if (computed.completed) {
    await createNotification(milestone.userId, {
      type: 'MILESTONE_COMPLETED',
      title: milestone.title,
      body: 'This milestone is complete.',
      milestoneId: milestone.id,
      dedupeKey: `milestone:${milestone.id}:completed`,
    });
  }
  if (computed.missed) {
    await createNotification(milestone.userId, {
      type: 'MILESTONE_MISSED',
      title: milestone.title,
      body: 'This milestone expired before completion. You can always try a lighter next goal.',
      milestoneId: milestone.id,
      dedupeKey: `milestone:${milestone.id}:missed`,
    });
  }
}

export async function recomputeMilestoneProgress(
  userId: string,
  milestoneId: string,
  now = new Date(),
): Promise<ComputedMilestoneProgress> {
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, userId } });
  if (!milestone) throw new ApiError('NOT_FOUND', 'Milestone not found.');
  const computed = await computeMilestoneProgress(userId, milestone, now);
  await persistComputedProgress(milestone, computed);
  return computed;
}

export async function recomputeActiveMilestonesForUser(
  userId: string,
  now = new Date(),
): Promise<ComputedMilestoneProgress[]> {
  const milestones = await prisma.milestone.findMany({
    where: { userId, status: { in: ['ACTIVE'] } },
    orderBy: { createdAt: 'asc' },
  });
  const results: ComputedMilestoneProgress[] = [];
  for (const milestone of milestones) {
    const computed = await computeMilestoneProgress(userId, milestone, now);
    await persistComputedProgress(milestone, computed);
    results.push(computed);
  }
  return results;
}

export async function recordCustomMilestoneProgress(
  userId: string,
  milestoneId: string,
  value: number,
): Promise<ComputedMilestoneProgress> {
  if (!Number.isFinite(value) || value < 0) {
    throw new ApiError('VALIDATION_ERROR', 'Progress must be a positive number.');
  }
  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, userId, type: 'CUSTOM_NUMERIC' },
  });
  if (!milestone) throw new ApiError('NOT_FOUND', 'Custom milestone not found.');

  const targetValue = targetValueOf(milestone);
  const computed: ComputedMilestoneProgress = {
    milestoneId,
    type: milestone.type,
    currentValue: value,
    targetValue,
    percent: milestonePercent(startValueOf(milestone), value, targetValue),
    method: 'custom_numeric',
    completed: value >= targetValue,
    missed: false,
  };
  await persistComputedProgress(milestone, computed);
  return computed;
}

