import 'server-only';
import { Prisma, type AlertSensitivity, type MaintenanceProfile } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { toNumber } from '@/lib/utils';
import { addDaysISO, todayISO, toZonedDayISO } from '@/lib/dates';
import { suggestDailyCalorieTarget } from '@/lib/calories';
import { milestonePercent, type WeightDirection, type WeightPoint } from '@/lib/milestone-progress';
import * as M from '@/lib/maintenance';
import { getUserTimezone } from './profile';
import { getGoalForDay, setGoal } from './goals';
import { getActiveGoalMode, setGoalMode } from './goal-mode';
import { COUNTED_MEAL_STATUS } from './meal';
import type {
  ActivateMaintenanceInput,
  UpdateRangeInput,
  UpdateTargetsInput,
} from '@/lib/validation/maintenance';

// ------------------------------------------------------------------
// Loaders & shared context
// ------------------------------------------------------------------

async function loadWeightPoints(userId: string): Promise<WeightPoint[]> {
  const rows = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { entryDate: 'asc' },
    select: { entryDate: true, weightKg: true },
  });
  return rows.map((r) => ({ date: r.entryDate.toISOString().slice(0, 10), value: toNumber(r.weightKg) }));
}

interface DayTotals {
  calories: number;
  count: number;
  protein: number;
}

async function dailyMealTotals(userId: string, timezone: string): Promise<Map<string, DayTotals>> {
  const meals = await prisma.meal.findMany({
    where: { userId, status: COUNTED_MEAL_STATUS },
    select: { mealDateTime: true, finalCalories: true, proteinGrams: true },
  });
  const byDay = new Map<string, DayTotals>();
  for (const meal of meals) {
    const day = toZonedDayISO(meal.mealDateTime, timezone);
    const bucket = byDay.get(day) ?? { calories: 0, count: 0, protein: 0 };
    bucket.calories += meal.finalCalories ?? 0;
    bucket.count += 1;
    bucket.protein += toNumber(meal.proteinGrams);
    byDay.set(day, bucket);
  }
  return byDay;
}

function parseProfile(row: MaintenanceProfile) {
  return {
    targetWeightKg: toNumber(row.targetWeightKg),
    range: { lower: toNumber(row.lowerBoundaryKg), upper: toNumber(row.upperBoundaryKg) } as M.MaintenanceRange,
    toleranceKg: toNumber(row.toleranceKg),
    weighInsPerWeek: row.weighInsPerWeek,
    calorieTarget: row.calorieTarget,
    proteinGrams: row.proteinGrams === null ? null : toNumber(row.proteinGrams),
    carbohydrateGrams: row.carbohydrateGrams === null ? null : toNumber(row.carbohydrateGrams),
    fatGrams: row.fatGrams === null ? null : toNumber(row.fatGrams),
    weeklyCalorieMin: row.weeklyCalorieMin,
    weeklyCalorieMax: row.weeklyCalorieMax,
    alertSensitivity: row.alertSensitivity,
    activatedAt: row.activatedAt.toISOString(),
  };
}

/** Ημέρες με μέτρηση βάρους μέσα σε παράθυρο [today-days+1, today]. */
function countWeighInsInWindow(points: WeightPoint[], today: string, days: number): number {
  const from = addDaysISO(today, -(days - 1));
  return points.filter((p) => p.date >= from && p.date <= today).length;
}

/** Μέγιστη σειρά διαδοχικών πιο πρόσφατων μετρήσεων που ικανοποιούν το predicate. */
function trailingRun(points: WeightPoint[], predicate: (v: number) => boolean): number {
  let run = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (predicate(points[i]!.value)) run += 1;
    else break;
  }
  return run;
}

export interface MaintenanceContext {
  timezone: string;
  today: string;
  profile: ReturnType<typeof parseProfile>;
  points: WeightPoint[];
  avg7: number | null;
  avg14: number | null;
  avg30: number | null;
  variability: number;
  status: M.MaintenanceStatus;
  center: number;
  distanceFromCenter: number;
  trend: M.TrendDirection;
  slopeKgPerDay: number;
  trendDays: number;
  daysInRange30: number;
  weighInDays30: number;
  weighInsLast7: number;
  weighInsLast14: number;
  expectedWeighInsLast7: number;
  calorieAvg7: number | null;
  calorieAvg30: number | null;
  loggedDays7: number;
  loggedDays30: number;
  completeDays7: number;
  sustainedAboveDays: number;
  sustainedBelowDays: number;
}

function averageOfDays(byDay: Map<string, DayTotals>, today: string, days: number): {
  calorieAvg: number | null;
  loggedDays: number;
  completeDays: number;
  proteinDays: number;
} {
  const from = addDaysISO(today, -(days - 1));
  let sum = 0;
  let logged = 0;
  let complete = 0;
  let proteinDays = 0;
  for (const [day, totals] of byDay) {
    if (day < from || day > today) continue;
    if (totals.count > 0) {
      logged += 1;
      sum += totals.calories;
      if (totals.count >= 3) complete += 1;
      if (totals.protein > 0) proteinDays += 1;
    }
  }
  return {
    calorieAvg: logged > 0 ? Math.round(sum / logged) : null,
    loggedDays: logged,
    completeDays: complete,
    proteinDays,
  };
}

async function buildContext(userId: string, row: MaintenanceProfile): Promise<MaintenanceContext> {
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const profile = parseProfile(row);
  const points = await loadWeightPoints(userId);
  const byDay = await dailyMealTotals(userId, timezone);

  const avg7 = M.movingAverage(points, 7);
  const avg14 = M.movingAverage(points, 14);
  const avg30 = M.movingAverage(points, 30);
  const variability = M.weightVariability(points, 30);
  const { status, center, distanceFromCenter } = M.classifyStatus(avg7, profile.range);
  const trendInfo = M.trendDirection(points, 14);
  const trendWindowFrom = addDaysISO(today, -13);
  const trendDays = points.filter((p) => p.date >= trendWindowFrom && p.date <= today).length;

  const cal7 = averageOfDays(byDay, today, 7);
  const cal30 = averageOfDays(byDay, today, 30);

  return {
    timezone,
    today,
    profile,
    points,
    avg7,
    avg14,
    avg30,
    variability,
    status,
    center,
    distanceFromCenter,
    trend: trendInfo.direction,
    slopeKgPerDay: trendInfo.slopeKgPerDay,
    trendDays,
    daysInRange30: M.daysWithinRange(
      points.filter((p) => p.date >= addDaysISO(today, -29) && p.date <= today),
      profile.range,
    ),
    weighInDays30: countWeighInsInWindow(points, today, 30),
    weighInsLast7: countWeighInsInWindow(points, today, 7),
    weighInsLast14: countWeighInsInWindow(points, today, 14),
    expectedWeighInsLast7: profile.weighInsPerWeek,
    calorieAvg7: cal7.calorieAvg,
    calorieAvg30: cal30.calorieAvg,
    loggedDays7: cal7.loggedDays,
    loggedDays30: cal30.loggedDays,
    completeDays7: cal7.completeDays,
    sustainedAboveDays: trailingRun(points, (v) => v > profile.range.upper),
    sustainedBelowDays: trailingRun(points, (v) => v < profile.range.lower),
  };
}

async function requireMaintenanceProfile(userId: string): Promise<MaintenanceProfile> {
  const row = await prisma.maintenanceProfile.findUnique({ where: { userId } });
  if (!row) throw new ApiError('NOT_FOUND', 'Maintenance mode is not active.');
  return row;
}

// ------------------------------------------------------------------
// Eligibility & activation
// ------------------------------------------------------------------

export interface EligibilityView {
  eligible: boolean;
  alreadyActive: boolean;
  method: string;
  current: number | null;
  targetWeightKg: number | null;
  toleranceKg: number;
  progressPercent: number;
  suggestedRange: M.MaintenanceRange | null;
  suggestedCalorieTarget: number | null;
  currentCalorieTarget: number | null;
}

function directionFor(goal: 'LOSE' | 'MAINTAIN' | 'GAIN'): WeightDirection {
  return goal === 'GAIN' ? 'gain' : 'loss';
}

export async function getEligibility(userId: string): Promise<EligibilityView> {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  const mode = await getActiveGoalMode(userId);
  const alreadyActive = mode.mode === 'MAINTENANCE';

  if (!profile || profile.targetWeightKg === null) {
    return {
      eligible: false,
      alreadyActive,
      method: 'no_target',
      current: null,
      targetWeightKg: null,
      toleranceKg: 0,
      progressPercent: 0,
      suggestedRange: null,
      suggestedCalorieTarget: null,
      currentCalorieTarget: null,
    };
  }

  const target = toNumber(profile.targetWeightKg);
  const points = await loadWeightPoints(userId);
  const direction = directionFor(profile.goal);
  const elig = M.computeMaintenanceEligibility(points, target, direction);

  const start = points[0] ? points[0].value : target;
  const currentForProgress = elig.current ?? start;
  const progressPercent = milestonePercent(start, currentForProgress, target);

  const today = todayISO(profile.timezone);
  const currentGoal = await getGoalForDay(userId, today);
  const suggestedCalorieTarget = suggestDailyCalorieTarget({
    gender: profile.gender,
    heightCm: toNumber(profile.heightCm),
    weightKg: target,
    birthDate: profile.birthDate,
    activityLevel: profile.activityLevel,
    goal: 'MAINTAIN',
  });

  return {
    eligible: elig.eligible,
    alreadyActive,
    method: elig.method,
    current: elig.current,
    targetWeightKg: target,
    toleranceKg: elig.toleranceKg,
    progressPercent,
    suggestedRange: M.suggestMaintenanceRange(target),
    suggestedCalorieTarget,
    currentCalorieTarget: currentGoal.calorieTarget,
  };
}

export async function activateMaintenance(
  userId: string,
  input: ActivateMaintenanceInput,
): Promise<{ activated: true }> {
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const dec = (n: number) => new Prisma.Decimal(n.toFixed(2));
  const decN = (n: number | null | undefined) =>
    n === null || n === undefined ? null : new Prisma.Decimal(n.toFixed(2));

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceProfile.upsert({
      where: { userId },
      create: {
        userId,
        targetWeightKg: dec(input.targetWeightKg),
        lowerBoundaryKg: dec(input.lowerBoundaryKg),
        upperBoundaryKg: dec(input.upperBoundaryKg),
        weighInsPerWeek: input.weighInsPerWeek,
        calorieTarget: input.calorieTarget,
        proteinGrams: decN(input.proteinGrams),
        carbohydrateGrams: decN(input.carbohydrateGrams),
        fatGrams: decN(input.fatGrams),
        weeklyCalorieMin: input.weeklyCalorieMin ?? null,
        weeklyCalorieMax: input.weeklyCalorieMax ?? null,
        alertSensitivity: input.alertSensitivity,
      },
      update: {
        targetWeightKg: dec(input.targetWeightKg),
        lowerBoundaryKg: dec(input.lowerBoundaryKg),
        upperBoundaryKg: dec(input.upperBoundaryKg),
        weighInsPerWeek: input.weighInsPerWeek,
        calorieTarget: input.calorieTarget,
        proteinGrams: decN(input.proteinGrams),
        carbohydrateGrams: decN(input.carbohydrateGrams),
        fatGrams: decN(input.fatGrams),
        weeklyCalorieMin: input.weeklyCalorieMin ?? null,
        weeklyCalorieMax: input.weeklyCalorieMax ?? null,
        alertSensitivity: input.alertSensitivity,
      },
    });

    await tx.maintenanceRangeHistory.create({
      data: {
        userId,
        targetWeightKg: dec(input.targetWeightKg),
        lowerBoundaryKg: dec(input.lowerBoundaryKg),
        upperBoundaryKg: dec(input.upperBoundaryKg),
        effectiveFrom: todayDate,
        reason: 'activation',
      },
    });
  });

  // Mode change έχει δικό του transaction/ιστορικό — ρητή ενέργεια, όχι αυτόματη.
  await setGoalMode(userId, 'MAINTENANCE', {
    reason: 'reached_target',
    targetWeightKg: input.targetWeightKg,
    calorieTarget: input.calorieTarget,
  });

  // Ο ημερήσιος στόχος θερμίδων αλλάζει ΜΟΝΟ αν ο χρήστης το ζήτησε ρητά.
  if (input.applyCalorieTarget) {
    await setGoal(
      userId,
      {
        calorieTarget: input.calorieTarget,
        source: 'MANUAL',
        proteinGrams: input.proteinGrams ?? null,
        carbohydrateGrams: input.carbohydrateGrams ?? null,
        fatGrams: input.fatGrams ?? null,
      },
      today,
    );
  }

  logger.info('maintenance_activated', { userId, applyCalorieTarget: input.applyCalorieTarget });

  void import('./goals-evaluator').then(({ evaluateGoalsForUserBestEffort }) =>
    evaluateGoalsForUserBestEffort(userId),
  );
  return { activated: true };
}

// ------------------------------------------------------------------
// Dashboard, trends, report
// ------------------------------------------------------------------

export interface MaintenanceDashboard {
  active: boolean;
  today: string;
  range: M.MaintenanceRange;
  targetWeightKg: number;
  current7dAverage: number | null;
  status: M.MaintenanceStatus;
  distanceFromCenter: number;
  center: number;
  stability: {
    avg7: number | null;
    avg14: number | null;
    avg30: number | null;
    variability: number;
    daysWithinRange30: number;
  };
  calorie: {
    avg7: number | null;
    avg30: number | null;
    target: number;
    diffFromTarget: number | null;
    completeDays7: number;
  };
  habits: HabitConsistency;
  score: M.StabilityScore;
  recommendations: M.MaintenanceRecommendation[];
}

export interface HabitConsistency {
  mealLoggingPercent: number;
  proteinTargetPercent: number;
  waterTrackingPercent: number;
  activityPercent: number;
  weighInPercent: number;
}

async function habitConsistency(
  userId: string,
  ctx: MaintenanceContext,
  byDay: Map<string, DayTotals>,
): Promise<HabitConsistency> {
  const windowDays = 30;
  const from = addDaysISO(ctx.today, -(windowDays - 1));

  // Meal logging & protein
  let proteinDays = 0;
  let loggedDays = 0;
  for (const [day, totals] of byDay) {
    if (day < from || day > ctx.today) continue;
    if (totals.count > 0) {
      loggedDays += 1;
      const goal = await getGoalForDay(userId, day);
      if (goal.proteinGrams && totals.protein >= goal.proteinGrams) proteinDays += 1;
    }
  }

  // Water
  const water = await prisma.waterEntry.findMany({
    where: { userId, entryDate: { gte: new Date(`${from}T00:00:00.000Z`) } },
    select: { entryDate: true, volumeMl: true },
  });
  const waterByDay = new Map<string, number>();
  for (const w of water) {
    const day = w.entryDate.toISOString().slice(0, 10);
    waterByDay.set(day, (waterByDay.get(day) ?? 0) + w.volumeMl);
  }
  let waterDays = 0;
  for (const [day, vol] of waterByDay) {
    const goal = await getGoalForDay(userId, day);
    if (vol >= goal.waterMl) waterDays += 1;
  }

  // Activity
  const activity = await prisma.activityEntry.findMany({
    where: { userId, entryDate: { gte: new Date(`${from}T00:00:00.000Z`) } },
    select: { entryDate: true },
  });
  const activityDays = new Set(activity.map((a) => a.entryDate.toISOString().slice(0, 10))).size;

  const pct = (n: number) => Math.round((Math.min(n, windowDays) / windowDays) * 100);
  return {
    mealLoggingPercent: pct(loggedDays),
    proteinTargetPercent: pct(proteinDays),
    waterTrackingPercent: pct(waterDays),
    activityPercent: pct(activityDays),
    weighInPercent: pct(countUniqueWeighDays(ctx.points, from, ctx.today)),
  };
}

function countUniqueWeighDays(points: WeightPoint[], from: string, to: string): number {
  return new Set(points.filter((p) => p.date >= from && p.date <= to).map((p) => p.date)).size;
}

function scoreInputsFrom(ctx: MaintenanceContext): M.ScoreInputs {
  const sustained = Math.max(ctx.sustainedAboveDays, ctx.sustainedBelowDays);
  return {
    daysInRange: ctx.daysInRange30,
    totalDays: Math.max(1, ctx.weighInDays30),
    weighIns: ctx.weighInsLast14,
    expectedWeighIns: ctx.profile.weighInsPerWeek * 2,
    loggedDays: ctx.loggedDays30,
    expectedLogDays: 30,
    calorieAvg: ctx.calorieAvg30,
    calorieTarget: ctx.profile.calorieTarget,
    sustainedDeviationDays: sustained,
  };
}

export async function getMaintenanceDashboard(userId: string): Promise<MaintenanceDashboard> {
  const row = await requireMaintenanceProfile(userId);
  const ctx = await buildContext(userId, row);
  const byDay = await dailyMealTotals(userId, ctx.timezone);
  const habits = await habitConsistency(userId, ctx, byDay);
  const score = M.computeStabilityScore(scoreInputsFrom(ctx));
  const recommendations = M.deriveRecommendations({
    status: ctx.status,
    loggedDays: ctx.loggedDays7,
    expectedLogDays: 7,
    trend: ctx.trend,
  });

  return {
    active: true,
    today: ctx.today,
    range: ctx.profile.range,
    targetWeightKg: ctx.profile.targetWeightKg,
    current7dAverage: ctx.avg7,
    status: ctx.status,
    distanceFromCenter: ctx.distanceFromCenter,
    center: ctx.center,
    stability: {
      avg7: ctx.avg7,
      avg14: ctx.avg14,
      avg30: ctx.avg30,
      variability: ctx.variability,
      daysWithinRange30: ctx.daysInRange30,
    },
    calorie: {
      avg7: ctx.calorieAvg7,
      avg30: ctx.calorieAvg30,
      target: ctx.profile.calorieTarget,
      diffFromTarget: ctx.calorieAvg7 === null ? null : ctx.calorieAvg7 - ctx.profile.calorieTarget,
      completeDays7: ctx.completeDays7,
    },
    habits,
    score,
    recommendations,
  };
}

export interface TrendPoint {
  date: string;
  value: number;
}
export interface MaintenanceTrends {
  range: M.MaintenanceRange;
  points: TrendPoint[];
  average7d: TrendPoint[];
}

/** Ημερήσιο βάρος + κυλιόμενος 7ήμερος για το γράφημα (τελευταίες 90 ημέρες). */
export async function getTrends(userId: string): Promise<MaintenanceTrends> {
  const row = await requireMaintenanceProfile(userId);
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const from = addDaysISO(today, -89);
  const points = (await loadWeightPoints(userId)).filter((p) => p.date >= from && p.date <= today);

  const average7d: TrendPoint[] = points.map((p, i) => {
    const windowStart = addDaysISO(p.date, -6);
    const window = points.slice(0, i + 1).filter((q) => q.date >= windowStart && q.date <= p.date);
    const avg = window.reduce((s, q) => s + q.value, 0) / window.length;
    return { date: p.date, value: Math.round(avg * 100) / 100 };
  });

  return {
    range: { lower: toNumber(row.lowerBoundaryKg), upper: toNumber(row.upperBoundaryKg) },
    points,
    average7d,
  };
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  movingAverage: number | null;
  range: M.MaintenanceRange;
  daysWithinRange: number;
  averageCalories: number | null;
  loggingCompletenessPercent: number;
  proteinConsistencyPercent: number;
  waterConsistencyPercent: number;
  activityConsistencyPercent: number;
  previousWeekAverage: number | null;
  averageDeltaKg: number | null;
  trend: M.TrendDirection;
  suggestedNextAction: string;
}

export async function getWeeklyReport(userId: string): Promise<WeeklyReport> {
  const row = await requireMaintenanceProfile(userId);
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const weekStart = addDaysISO(today, -6);
  const prevStart = addDaysISO(today, -13);
  const prevEnd = addDaysISO(today, -7);
  const range = { lower: toNumber(row.lowerBoundaryKg), upper: toNumber(row.upperBoundaryKg) };

  const allPoints = await loadWeightPoints(userId);
  const thisWeekPoints = allPoints.filter((p) => p.date >= weekStart && p.date <= today);
  const prevWeekPoints = allPoints.filter((p) => p.date >= prevStart && p.date <= prevEnd);

  const byDay = await dailyMealTotals(userId, timezone);
  const cal = averageOfDays(byDay, today, 7);

  // Water & activity consistency for the week
  const water = await prisma.waterEntry.findMany({
    where: { userId, entryDate: { gte: new Date(`${weekStart}T00:00:00.000Z`) } },
    select: { entryDate: true, volumeMl: true },
  });
  const waterByDay = new Map<string, number>();
  for (const w of water) {
    const day = w.entryDate.toISOString().slice(0, 10);
    waterByDay.set(day, (waterByDay.get(day) ?? 0) + w.volumeMl);
  }
  let waterDays = 0;
  for (const [day, vol] of waterByDay) {
    const goal = await getGoalForDay(userId, day);
    if (vol >= goal.waterMl) waterDays += 1;
  }
  const activity = await prisma.activityEntry.findMany({
    where: { userId, entryDate: { gte: new Date(`${weekStart}T00:00:00.000Z`) } },
    select: { entryDate: true },
  });
  const activityDays = new Set(activity.map((a) => a.entryDate.toISOString().slice(0, 10))).size;

  const thisAvg = thisWeekPoints.length
    ? Math.round((thisWeekPoints.reduce((s, p) => s + p.value, 0) / thisWeekPoints.length) * 100) / 100
    : null;
  const prevAvg = prevWeekPoints.length
    ? Math.round((prevWeekPoints.reduce((s, p) => s + p.value, 0) / prevWeekPoints.length) * 100) / 100
    : null;

  const trend = M.trendDirection(allPoints.filter((p) => p.date >= prevStart), 14).direction;
  const rec = M.deriveRecommendations({
    status: M.classifyStatus(thisAvg, range).status,
    loggedDays: cal.loggedDays,
    expectedLogDays: 7,
    trend,
  });

  const pct = (n: number) => Math.round((Math.min(n, 7) / 7) * 100);
  return {
    weekStart,
    weekEnd: today,
    movingAverage: thisAvg,
    range,
    daysWithinRange: M.daysWithinRange(thisWeekPoints, range),
    averageCalories: cal.calorieAvg,
    loggingCompletenessPercent: pct(cal.loggedDays),
    proteinConsistencyPercent: pct(cal.proteinDays),
    waterConsistencyPercent: pct(waterDays),
    activityConsistencyPercent: pct(activityDays),
    previousWeekAverage: prevAvg,
    averageDeltaKg: thisAvg !== null && prevAvg !== null ? Math.round((thisAvg - prevAvg) * 100) / 100 : null,
    trend,
    suggestedNextAction: rec[0]?.message ?? 'Keep your current target — things look steady.',
  };
}

// ------------------------------------------------------------------
// Range & target updates
// ------------------------------------------------------------------

export async function updateRange(userId: string, input: UpdateRangeInput): Promise<{ updated: true }> {
  await requireMaintenanceProfile(userId);
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const dec = (n: number) => new Prisma.Decimal(n.toFixed(2));

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceProfile.update({
      where: { userId },
      data: {
        targetWeightKg: dec(input.targetWeightKg),
        lowerBoundaryKg: dec(input.lowerBoundaryKg),
        upperBoundaryKg: dec(input.upperBoundaryKg),
      },
    });
    await tx.maintenanceRangeHistory.create({
      data: {
        userId,
        targetWeightKg: dec(input.targetWeightKg),
        lowerBoundaryKg: dec(input.lowerBoundaryKg),
        upperBoundaryKg: dec(input.upperBoundaryKg),
        effectiveFrom: new Date(`${today}T00:00:00.000Z`),
        reason: input.reason ?? 'manual_update',
      },
    });
  });
  return { updated: true };
}

export async function updateTargets(
  userId: string,
  input: UpdateTargetsInput,
): Promise<{ updated: true }> {
  await requireMaintenanceProfile(userId);
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const decN = (n: number | null | undefined) =>
    n === null || n === undefined ? null : new Prisma.Decimal(n.toFixed(2));

  await prisma.maintenanceProfile.update({
    where: { userId },
    data: {
      calorieTarget: input.calorieTarget,
      proteinGrams: decN(input.proteinGrams),
      carbohydrateGrams: decN(input.carbohydrateGrams),
      fatGrams: decN(input.fatGrams),
      weeklyCalorieMin: input.weeklyCalorieMin ?? null,
      weeklyCalorieMax: input.weeklyCalorieMax ?? null,
      ...(input.alertSensitivity ? { alertSensitivity: input.alertSensitivity } : {}),
      ...(input.weighInsPerWeek ? { weighInsPerWeek: input.weighInsPerWeek } : {}),
    },
  });

  // Ο ημερήσιος στόχος θερμίδων ενημερώνεται ΜΟΝΟ αν ζητηθεί ρητά.
  if (input.applyCalorieTarget) {
    await setGoal(
      userId,
      {
        effectiveFrom: input.effectiveFrom,
        calorieTarget: input.calorieTarget,
        source: 'MANUAL',
        proteinGrams: input.proteinGrams ?? null,
        carbohydrateGrams: input.carbohydrateGrams ?? null,
        fatGrams: input.fatGrams ?? null,
      },
      today,
    );
  }
  return { updated: true };
}

// ------------------------------------------------------------------
// Alerts
// ------------------------------------------------------------------

export interface AlertView {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
  dismissedAt: string | null;
}

export async function listAlerts(userId: string, includeDismissed = false): Promise<AlertView[]> {
  const rows = await prisma.maintenanceAlert.findMany({
    where: { userId, ...(includeDismissed ? {} : { dismissedAt: null }) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    severity: r.severity,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    dismissedAt: r.dismissedAt ? r.dismissedAt.toISOString() : null,
  }));
}

export async function dismissAlert(userId: string, alertId: string): Promise<void> {
  const updated = await prisma.maintenanceAlert.updateMany({
    where: { id: alertId, userId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Alert not found.');
}

/**
 * Επαναϋπολογίζει την κατάσταση συντήρησης και δημιουργεί νέα alerts idempotently
 * (unique userId+dedupeKey). Καλείται μετά από κάθε ζύγιση. No-op αν το mode δεν
 * είναι ενεργό.
 */
export async function evaluateMaintenanceForUser(userId: string): Promise<void> {
  const mode = await getActiveGoalMode(userId);
  if (mode.mode !== 'MAINTENANCE') return;
  const row = await prisma.maintenanceProfile.findUnique({ where: { userId } });
  if (!row) return;

  const ctx = await buildContext(userId, row);
  const drafts = M.deriveAlerts(
    {
      dayISO: ctx.today,
      status: ctx.status,
      sustainedAboveDays: ctx.sustainedAboveDays,
      sustainedBelowDays: ctx.sustainedBelowDays,
      weighInsLast7: ctx.weighInsLast7,
      expectedWeighInsLast7: ctx.expectedWeighInsLast7,
      trend: ctx.trend,
      trendDays: ctx.trendDays,
    },
    ctx.profile.alertSensitivity as AlertSensitivity,
  );

  for (const draft of drafts) {
    const existing = await prisma.maintenanceAlert.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey: draft.dedupeKey } },
    });
    if (existing) continue;
    await prisma.maintenanceAlert.create({
      data: {
        userId,
        type: draft.type,
        severity: draft.severity,
        message: draft.message,
        dedupeKey: draft.dedupeKey,
      },
    });
  }
}
