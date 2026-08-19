import { ACTIVITY_FACTORS, CALORIE_LIMITS } from './constants';
import { ageFromBirthDate } from './dates';
import { clamp } from './utils';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';

export interface BmrInput {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  birthDate: Date;
  now?: Date;
}

/**
 * Mifflin-St Jeor. Για OTHER/UNDISCLOSED χρησιμοποιούμε τον μέσο όρο των δύο
 * συντελεστών, ώστε να μην απαιτείται δήλωση φύλου.
 * ΠΡΟΣΟΧΗ: εκτίμηση, όχι ιατρική συμβουλή.
 */
export function calculateBmr({ gender, heightCm, weightKg, birthDate, now }: BmrInput): number {
  const age = ageFromBirthDate(birthDate, now);
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = gender === 'MALE' ? 5 : gender === 'FEMALE' ? -161 : (5 + -161) / 2;
  return Math.max(0, Math.round(base + offset));
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * (ACTIVITY_FACTORS[activityLevel] ?? 1.55));
}

const GOAL_DELTA: Record<Goal, number> = {
  LOSE: -500,
  MAINTAIN: 0,
  GAIN: 350,
};

/**
 * Προτεινόμενος ημερήσιος στόχος. Το αποτέλεσμα περιορίζεται σε λογικά όρια
 * ώστε να μην προτείνεται ποτέ επικίνδυνα χαμηλή πρόσληψη.
 */
export function suggestDailyCalorieTarget(input: BmrInput & { activityLevel: ActivityLevel; goal: Goal }): number {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activityLevel);
  const raw = tdee + GOAL_DELTA[input.goal];
  const floor = Math.max(CALORIE_LIMITS.minDailyTarget, Math.round(bmr * 0.9));
  return clamp(Math.round(raw / 10) * 10, floor, CALORIE_LIMITS.maxDailyTarget);
}

export interface DailySummary {
  consumed: number;
  target: number | null;
  remaining: number | null;
  progressPercent: number;
  overTarget: boolean;
}

export function buildDailySummary(consumed: number, target: number | null): DailySummary {
  const safeConsumed = Math.max(0, Math.round(consumed));
  if (!target || target <= 0) {
    return {
      consumed: safeConsumed,
      target: null,
      remaining: null,
      progressPercent: 0,
      overTarget: false,
    };
  }
  const remaining = target - safeConsumed;
  return {
    consumed: safeConsumed,
    target,
    remaining,
    progressPercent: clamp(Math.round((safeConsumed / target) * 100), 0, 999),
    overTarget: remaining < 0,
  };
}

/** Οι θερμίδες αποθηκεύονται πάντα ως μη αρνητικοί ακέραιοι εντός ορίων. */
export function normalizeCalories(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(Math.round(value), CALORIE_LIMITS.minPerMeal, CALORIE_LIMITS.hardMaxPerMeal);
}

export function isAboveSoftLimit(value: number): boolean {
  return value > CALORIE_LIMITS.softMaxPerMeal;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
