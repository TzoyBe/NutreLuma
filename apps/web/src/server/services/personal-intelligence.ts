import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { addDaysISO, toZonedDayISO, zonedDayRangeUtc } from '@/lib/dates';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

export async function recordMealCorrection(params: {
  userId: string;
  mealId: string;
  baseCalories: number | null;
  finalCalories: number | null;
  items: Array<{ name: string; calories: number | null }>;
}) {
  if (params.baseCalories === null || params.finalCalories === null) return;
  if (params.baseCalories === params.finalCalories) return;
  const difference = params.finalCalories - params.baseCalories;
  // Keep legacy write flows resilient while older test doubles/rolled-back deployments catch up.
  const client = prisma as typeof prisma & { mealCorrection?: typeof prisma.mealCorrection; userCalibrationFact?: typeof prisma.userCalibrationFact };
  if (!client.mealCorrection || !client.userCalibrationFact) return;
  await client.$transaction(async (tx) => {
    await tx.mealCorrection.create({
      data: {
        userId: params.userId,
        mealId: params.mealId,
        originalJson: json({ calories: params.baseCalories, items: params.items }),
        finalJson: json({ calories: params.finalCalories, items: params.items }),
        calorieDifference: difference,
      },
    });
    const previous = await tx.userCalibrationFact.findUnique({
      where: { userId_key: { userId: params.userId, key: 'correction_bias' } },
    });
    const samples = (previous?.sampleCount ?? 0) + 1;
    const oldBias = typeof previous?.valueJson === 'object' && previous.valueJson !== null && 'meanCalories' in previous.valueJson
      ? Number((previous.valueJson as { meanCalories?: unknown }).meanCalories ?? 0) : 0;
    const meanCalories = oldBias + (difference - oldBias) / samples;
    await tx.userCalibrationFact.upsert({
      where: { userId_key: { userId: params.userId, key: 'correction_bias' } },
      create: { userId: params.userId, key: 'correction_bias', valueJson: json({ meanCalories }), confidence: clamp(samples / 20), sampleCount: samples },
      update: { valueJson: json({ meanCalories }), confidence: clamp(samples / 20), sampleCount: samples },
    });
  });
}

export async function getPersonalCalibration(userId: string) {
  const [facts, confirmed, corrections] = await Promise.all([
    prisma.userCalibrationFact.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 30 }),
    prisma.meal.count({ where: { userId, status: 'CONFIRMED' } }),
    prisma.mealCorrection.count({ where: { userId } }),
  ]);
  const confidence = Math.round(clamp((Math.min(confirmed, 30) / 30) * 0.45 + (Math.min(corrections, 20) / 20) * 0.55) * 100);
  return { score: confidence, confirmedMeals: confirmed, corrections, facts };
}

export async function getCorrectionRates(userId: string, now = new Date()) {
  const periods = [7, 30, 0];
  const result: Record<string, number> = {};
  for (const days of periods) {
    const from = days ? new Date(now.getTime() - days * 86400000) : undefined;
    const [total, corrected] = await Promise.all([
      prisma.meal.count({ where: { userId, status: 'CONFIRMED', ...(from ? { confirmedAt: { gte: from } } : {}) } }),
      prisma.mealCorrection.count({ where: { userId, ...(from ? { createdAt: { gte: from } } : {}) } }),
    ]);
    result[days ? `${days}d` : 'all'] = total ? Math.round((corrected / total) * 100) : 0;
  }
  return result;
}

export function calculateMealDataConfidence(input: { source: string; confirmed: boolean; aiConfidence?: number | null; hasRange?: boolean }) {
  if (input.source === 'BARCODE' || input.source === 'NUTRITION_LABEL') return 0.95;
  if (input.source === 'SAVED_MEAL' || input.source === 'RECIPE') return 0.9;
  if (input.confirmed && input.source === 'AI_IMAGE') return clamp((input.aiConfidence ?? 0.55) * 0.7 + 0.3);
  if (input.source === 'AI_IMAGE') return input.hasRange ? 0.55 : 0.45;
  return input.confirmed ? 0.75 : 0.4;
}

export async function getDailyDataQuality(userId: string, dayISO: string, timezone: string) {
  const { start, end } = zonedDayRangeUtc(dayISO, timezone);
  const meals = await prisma.meal.findMany({ where: { userId, mealDateTime: { gte: start, lt: end }, status: 'CONFIRMED' }, select: { source: true, aiConfidence: true, aiMinCalories: true } });
  if (!meals.length) return { score: 0, level: 'UNKNOWN', meals: 0, complete: false };
  const score = Math.round(meals.reduce((sum, meal) => sum + calculateMealDataConfidence({ source: meal.source, confirmed: true, aiConfidence: meal.aiConfidence, hasRange: meal.aiMinCalories !== null }), 0) / meals.length * 100);
  return { score, level: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW', meals: meals.length, complete: meals.length >= 2 };
}

export async function getPersonalPatterns(userId: string, timezone: string) {
  const from = addDaysISO(toZonedDayISO(new Date(), timezone), -27);
  const start = zonedDayRangeUtc(from, timezone).start;
  const meals = await prisma.meal.findMany({ where: { userId, status: 'CONFIRMED', mealDateTime: { gte: start } }, select: { mealDateTime: true, finalCalories: true, mealType: true } });
  if (meals.length < 10) return [];
  const weekend = meals.filter((m) => [0, 6].includes(m.mealDateTime.getDay()));
  const weekday = meals.filter((m) => ![0, 6].includes(m.mealDateTime.getDay()));
  const avg = (rows: typeof meals) => rows.length ? rows.reduce((s, m) => s + (m.finalCalories ?? 0), 0) / rows.length : 0;
  const delta = Math.round(avg(weekend) - avg(weekday));
  if (Math.abs(delta) < 100) return [];
  return [{ type: 'WEEKEND', weekendHigher: delta > 0, deltaKcal: Math.abs(delta), title: 'Weekend pattern', message: `${delta > 0 ? 'Weekend' : 'Weekday'} meals average ${Math.abs(delta)} kcal ${delta > 0 ? 'more' : 'less'} in your tracked data.`, sampleCount: meals.length, confidence: clamp(meals.length / 40), completeness: clamp(meals.length / 28) }];
}

export async function getPersonalEnergyEstimate(userId: string, timezone: string) {
  const today = toZonedDayISO(new Date(), timezone);
  const from = addDaysISO(today, -27);
  const start = zonedDayRangeUtc(from, timezone).start;
  const end = zonedDayRangeUtc(today, timezone).end;
  const [meals, weights] = await Promise.all([
    prisma.meal.findMany({ where: { userId, status: 'CONFIRMED', mealDateTime: { gte: start, lt: end } }, select: { mealDateTime: true, finalCalories: true } }),
    prisma.weightEntry.findMany({ where: { userId, entryDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${today}T00:00:00.000Z`) } }, orderBy: { entryDate: 'asc' }, select: { weightKg: true } }),
  ]);
  const byDay = new Map<string, number>();
  for (const meal of meals) { const day = toZonedDayISO(meal.mealDateTime, timezone); byDay.set(day, (byDay.get(day) ?? 0) + (meal.finalCalories ?? 0)); }
  const completeDays = [...byDay.values()].filter((v) => v > 0).length;
  if (completeDays < 14 || weights.length < 4) return null;
  const intake = [...byDay.values()].reduce((a, b) => a + b, 0) / completeDays;
  const estimate = Math.round(intake);
  const confidence = clamp(Math.min(completeDays / 28, 1) * 0.65 + Math.min(weights.length / 8, 1) * 0.35);
  const saved = await prisma.personalEnergyEstimate.create({ data: { userId, startDate: new Date(`${from}T00:00:00.000Z`), endDate: new Date(`${today}T00:00:00.000Z`), estimatedCalories: estimate, confidence, weightSamples: weights.length, completeDays } });
  return saved;
}

export async function getIntelligenceSettings(userId: string) {
  return prisma.personalIntelligenceSettings.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function updateIntelligenceSettings(userId: string, data: Partial<{ personalCalibration: boolean; useMealHistory: boolean; useWeightHistory: boolean; useBehaviorPatterns: boolean }>) {
  return prisma.personalIntelligenceSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

export async function resetPersonalCalibration(userId: string) {
  await prisma.$transaction([
    prisma.userCalibrationFact.deleteMany({ where: { userId } }),
    prisma.personalIntelligenceSettings.updateMany({ where: { userId }, data: { personalCalibration: false } }),
  ]);
}
