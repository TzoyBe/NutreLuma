import 'server-only';
import type { MealType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { average, buildDailySummary, type DailySummary } from '@/lib/calories';
import { buildMacroProgress, type MacroProgress } from '@/lib/nutrition';
import {
  addDaysISO,
  dayRangeList,
  timezoneOffsetMs,
  toZonedDayISO,
  zonedDayRangeUtc,
} from '@/lib/dates';
import { MEAL_TYPES } from '@/lib/constants';
import { listWeightEntries } from './weight';
import {
  COUNTED_MEAL_STATUS,
  listMealsForDay,
  listPendingDrafts,
  type MealView,
} from './meal';
import { getUserTimezone } from './profile';
import { getGoalForDay, type GoalView } from './goals';

export const TIME_BUCKETS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

/** Κατηγοριοποίηση ώρας γεύματος (τοπική ώρα χρήστη) σε ζώνη ημέρας. */
function timeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export interface MacroSummary {
  protein: MacroProgress;
  carbohydrate: MacroProgress;
  fat: MacroProgress;
  fiber: MacroProgress;
}

export interface DashboardData {
  date: string;
  timezone: string;
  summary: DailySummary;
  macros: MacroSummary;
  goal: GoalView;
  meals: MealView[];
  /** Αναλύσεις που περιμένουν επιβεβαίωση — δεν μετρούν στα σύνολα. */
  drafts: MealView[];
}

/** Αθροίζει ένα macro από τα γεύματα· null όταν κανένα δεν το δηλώνει. */
function sumMacro(meals: MealView[], key: keyof MealView['macros']): number {
  return meals.reduce((sum, meal) => sum + (meal.macros[key] ?? 0), 0);
}

export async function getDashboard(userId: string, dayISO: string): Promise<DashboardData> {
  const timezone = await getUserTimezone(userId);
  const [goal, meals, drafts] = await Promise.all([
    getGoalForDay(userId, dayISO),
    listMealsForDay(userId, dayISO, timezone),
    listPendingDrafts(userId),
  ]);

  const consumed = meals.reduce((sum, meal) => sum + (meal.finalCalories ?? 0), 0);

  return {
    date: dayISO,
    timezone,
    summary: buildDailySummary(consumed, goal.calorieTarget),
    macros: {
      protein: buildMacroProgress(sumMacro(meals, 'proteinGrams'), goal.proteinGrams),
      carbohydrate: buildMacroProgress(
        sumMacro(meals, 'carbohydrateGrams'),
        goal.carbohydrateGrams,
      ),
      fat: buildMacroProgress(sumMacro(meals, 'fatGrams'), goal.fatGrams),
      fiber: buildMacroProgress(sumMacro(meals, 'fiberGrams'), goal.fiberGrams),
    },
    goal,
    meals,
    drafts,
  };
}

export interface DailyTotal {
  day: string;
  total: number;
  withinTarget: boolean | null;
}

/** Ημερήσια σύνολα για διάστημα, ομαδοποιημένα στη ζώνη ώρας του χρήστη. */
export async function getDailyTotals(
  userId: string,
  fromISO: string,
  toISO: string,
  timezone: string,
  target: number | null,
): Promise<DailyTotal[]> {
  const start = zonedDayRangeUtc(fromISO, timezone).start;
  const end = zonedDayRangeUtc(toISO, timezone).end;

  const meals = await prisma.meal.findMany({
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      finalCalories: { not: null },
      // Μόνο επιβεβαιωμένα: τα drafts δεν επηρεάζουν κανένα σύνολο.
      status: COUNTED_MEAL_STATUS,
    },
    select: { mealDateTime: true, finalCalories: true },
  });

  const buckets = new Map<string, number>();
  for (const day of dayRangeList(fromISO, toISO)) buckets.set(day, 0);
  for (const meal of meals) {
    const day = toZonedDayISO(meal.mealDateTime, timezone);
    buckets.set(day, (buckets.get(day) ?? 0) + (meal.finalCalories ?? 0));
  }

  return [...buckets.entries()].map(([day, total]) => ({
    day,
    total,
    withinTarget: target ? total > 0 && total <= target : null,
  }));
}

export interface MealTypeSlice {
  mealType: MealType;
  total: number;
  percent: number;
}

export interface StatsOverview {
  timezone: string;
  target: number | null;
  from: string;
  to: string;
  dailyTotals: DailyTotal[];
  weekTotal: number;
  weekAverage: number;
  monthTotal: number;
  monthAverage: number;
  average7: number;
  average30: number;
  daysWithinTargetPercent: number | null;
  daysLogged: number;
  distribution: MealTypeSlice[];
  avgIntake: number;
  weekdayAverages: { weekday: number; average: number }[];
  timeOfDay: { bucket: TimeBucket; total: number; percent: number }[];
  weight: {
    points: { day: string; value: number }[];
    first: number;
    last: number;
    deltaKg: number;
  } | null;
}

export async function getStatsOverview(userId: string, days: number): Promise<StatsOverview> {
  const timezone = await getUserTimezone(userId);
  const today = toZonedDayISO(new Date(), timezone);
  const target = (await getGoalForDay(userId, today)).calorieTarget;
  const from = addDaysISO(today, -(days - 1));

  const dailyTotals = await getDailyTotals(userId, from, today, timezone, target);
  const loggedDays = dailyTotals.filter((d) => d.total > 0);

  const last = (n: number) => dailyTotals.slice(-n);
  const totalsOf = (list: DailyTotal[]) => list.map((d) => d.total);
  const loggedTotalsOf = (list: DailyTotal[]) => list.filter((d) => d.total > 0).map((d) => d.total);

  const week = last(7);
  const month = last(30);

  const withinTargetDays = target ? loggedDays.filter((d) => d.total <= target).length : 0;

  const start = zonedDayRangeUtc(from, timezone).start;
  const end = zonedDayRangeUtc(today, timezone).end;
  const grouped = await prisma.meal.groupBy({
    by: ['mealType'],
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      finalCalories: { not: null },
      status: COUNTED_MEAL_STATUS,
    },
    _sum: { finalCalories: true },
  });
  const grandTotal = grouped.reduce((sum, row) => sum + (row._sum.finalCalories ?? 0), 0);
  const distribution: MealTypeSlice[] = MEAL_TYPES.map((mealType) => {
    const total = grouped.find((row) => row.mealType === mealType)?._sum.finalCalories ?? 0;
    return {
      mealType: mealType as MealType,
      total,
      percent: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
    };
  });

  // Μέσος όρος ανά ημέρα της εβδομάδας (μόνο ημέρες με καταγραφή).
  const weekdayArrays: number[][] = Array.from({ length: 7 }, () => []);
  for (const d of dailyTotals) {
    if (d.total <= 0) continue;
    const weekday = new Date(`${d.day}T00:00:00.000Z`).getUTCDay();
    weekdayArrays[weekday].push(d.total);
  }
  const weekdayAverages = weekdayArrays.map((arr, weekday) => ({
    weekday,
    average: average(arr),
  }));

  // Κατανομή θερμίδων ανά ζώνη ώρας (τοπική ώρα χρήστη).
  const mealTimes = await prisma.meal.findMany({
    where: {
      userId,
      mealDateTime: { gte: start, lt: end },
      finalCalories: { not: null },
      status: COUNTED_MEAL_STATUS,
    },
    select: { mealDateTime: true, finalCalories: true },
  });
  const timeTotals = new Map<TimeBucket, number>(TIME_BUCKETS.map((b) => [b, 0]));
  for (const meal of mealTimes) {
    const local = new Date(meal.mealDateTime.getTime() + timezoneOffsetMs(meal.mealDateTime, timezone));
    const bucket = timeBucket(local.getUTCHours());
    timeTotals.set(bucket, (timeTotals.get(bucket) ?? 0) + (meal.finalCalories ?? 0));
  }
  const timeGrand = [...timeTotals.values()].reduce((a, b) => a + b, 0);
  const timeOfDay = TIME_BUCKETS.map((bucket) => {
    const total = timeTotals.get(bucket) ?? 0;
    return { bucket, total, percent: timeGrand > 0 ? Math.round((total / timeGrand) * 100) : 0 };
  });

  // Τάση βάρους στο διάστημα, σε αύξουσα χρονική σειρά.
  const weightDesc = await listWeightEntries(userId, { from, to: today, limit: 400 });
  const weightAsc = [...weightDesc].reverse();
  const weight =
    weightAsc.length >= 2
      ? {
          points: weightAsc.map((entry) => ({ day: entry.entryDate, value: entry.weightKg })),
          first: weightAsc[0].weightKg,
          last: weightAsc[weightAsc.length - 1].weightKg,
          deltaKg:
            Math.round((weightAsc[weightAsc.length - 1].weightKg - weightAsc[0].weightKg) * 10) / 10,
        }
      : null;

  return {
    timezone,
    target,
    from,
    to: today,
    dailyTotals,
    weekTotal: totalsOf(week).reduce((a, b) => a + b, 0),
    weekAverage: average(loggedTotalsOf(week)),
    monthTotal: totalsOf(month).reduce((a, b) => a + b, 0),
    monthAverage: average(loggedTotalsOf(month)),
    average7: average(loggedTotalsOf(week)),
    average30: average(loggedTotalsOf(month)),
    daysWithinTargetPercent:
      target && loggedDays.length > 0
        ? Math.round((withinTargetDays / loggedDays.length) * 100)
        : null,
    daysLogged: loggedDays.length,
    distribution,
    avgIntake: average(loggedTotalsOf(dailyTotals)),
    weekdayAverages,
    timeOfDay,
    weight,
  };
}

/** Σύνολα ημέρας/εβδομάδας/μήνα για τη σελίδα ιστορικού. */
export async function getHistoryTotals(
  userId: string,
  anchorISO: string,
  timezone: string,
  target: number | null,
) {
  const weekFrom = addDaysISO(anchorISO, -6);
  const monthFrom = addDaysISO(anchorISO, -29);

  const monthTotals = await getDailyTotals(userId, monthFrom, anchorISO, timezone, target);
  const weekTotals = monthTotals.filter((d) => d.day >= weekFrom);
  const dayTotal = monthTotals.find((d) => d.day === anchorISO)?.total ?? 0;

  const loggedWeek = weekTotals.filter((d) => d.total > 0).map((d) => d.total);
  const loggedMonth = monthTotals.filter((d) => d.total > 0).map((d) => d.total);

  return {
    dayTotal,
    weekTotal: weekTotals.reduce((sum, d) => sum + d.total, 0),
    weekAverage: average(loggedWeek),
    monthTotal: monthTotals.reduce((sum, d) => sum + d.total, 0),
    monthAverage: average(loggedMonth),
    target,
  };
}
