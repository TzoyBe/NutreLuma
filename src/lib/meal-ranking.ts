import type { MealType } from '@prisma/client';

const HALF_LIFE_DAYS = 14;
const CONTEXT_MULTIPLIER = 1.5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Ώρα ημέρας -> αναμενόμενος τύπος γεύματος (στο timezone του χρήστη). */
export function expectedMealTypeForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'BREAKFAST';
  if (hour >= 11 && hour < 12.5) return 'MORNING_SNACK';
  if (hour >= 12.5 && hour < 16) return 'LUNCH';
  if (hour >= 16 && hour < 18.5) return 'AFTERNOON_SNACK';
  if (hour >= 18.5 && hour < 23) return 'DINNER';
  return 'OTHER';
}

export interface RankStats {
  usageCount: number;
  lastUsedAt: Date;
  groupMealType: MealType;
}

/** score = ln(1+count) * (0.5 + 0.5*recency) * contextMult, recency=0.5^(days/14). */
export function frequencyScore(stats: RankStats, now: Date, expected: MealType): number {
  const days = Math.max(0, (now.getTime() - stats.lastUsedAt.getTime()) / DAY_MS);
  const recency = Math.pow(0.5, days / HALF_LIFE_DAYS);
  const contextMult = stats.groupMealType === expected ? CONTEXT_MULTIPLIER : 1;
  return Math.log(1 + stats.usageCount) * (0.5 + 0.5 * recency) * contextMult;
}
