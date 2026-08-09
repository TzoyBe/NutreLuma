import 'server-only';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { getGoalForDay } from './goals';
import { getUserTimezone } from './profile';
import { getDailyTotals } from './stats';
import { getFrequentMeals } from './meal-history';
import { toZonedDayISO } from '@/lib/dates';

export async function getMealFit(userId: string, calories: number, protein = 0) {
  const timezone = await getUserTimezone(userId); const today = toZonedDayISO(new Date(), timezone);
  const [goal, totals] = await Promise.all([getGoalForDay(userId, today), getDailyTotals(userId, today, today, timezone, null)]);
  const consumed = totals[0]?.total ?? 0; const target = goal.calorieTarget ?? 0;
  return { calories, protein, consumed, remainingCalories: Math.max(0, target - consumed), fitsWithinTarget: target > 0 && consumed + calories <= target, afterChoiceRemaining: target - consumed - calories };
}

export async function fixMyDay(userId: string) {
  const timezone = await getUserTimezone(userId); const today = toZonedDayISO(new Date(), timezone);
  const [goal, totals, frequent] = await Promise.all([getGoalForDay(userId, today), getDailyTotals(userId, today, today, timezone, null), getFrequentMeals(userId, { now: new Date(), hour: new Date().getHours(), limit: 3 })]);
  const remaining = Math.max(0, (goal.calorieTarget ?? 0) - (totals[0]?.total ?? 0));
  return { remainingCalories: remaining, options: frequent.filter((m) => (m.meal.finalCalories ?? Infinity) <= remaining).slice(0, 3).map((m) => ({ kind: 'saved', title: m.meal.title, calories: m.meal.finalCalories, protein: m.meal.macros.proteinGrams, fingerprint: m.fingerprint })) };
}

export async function getWeightChangeInsight(userId: string) {
  const entries = await prisma.weightEntry.findMany({ where: { userId }, orderBy: { entryDate: 'desc' }, take: 8, select: { weightKg: true, entryDate: true } });
  if (entries.length < 2) return null;
  const change = entries[0].weightKg.toNumber() - entries[1].weightKg.toNumber();
  if (Math.abs(change) < 0.3) return { changeKg: change, message: 'Your recent scale change is within normal short-term variation in your tracked data.' };
  return { changeKg: change, message: `Your weight changed ${Math.abs(change).toFixed(1)} kg since the previous entry. A one-day change may reflect normal short-term fluctuation; your longer trend is more informative.` };
}

export async function saveWeeklyBudget(userId: string, weekStart: Date, totalCalories: number, dailyPlan: number[], enabled: boolean) {
  if (dailyPlan.length !== 7 || dailyPlan.some((n) => !Number.isFinite(n) || n < 1200)) throw new ApiError('VALIDATION_ERROR', 'Weekly plan must contain seven reasonable daily targets.');
  if (Math.abs(dailyPlan.reduce((a, b) => a + b, 0) - totalCalories) > 10) throw new ApiError('VALIDATION_ERROR', 'Daily plan must match the weekly target.');
  return prisma.weeklyBudget.upsert({ where: { userId_weekStart: { userId, weekStart } }, create: { userId, weekStart, totalCalories, dailyPlan, enabled }, update: { totalCalories, dailyPlan, enabled } });
}
