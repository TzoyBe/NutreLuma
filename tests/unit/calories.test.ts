import { describe, expect, it } from 'vitest';
import {
  buildDailySummary,
  calculateBmr,
  calculateTdee,
  normalizeCalories,
  suggestDailyCalorieTarget,
} from '@/lib/calories';

const now = new Date('2026-08-04T12:00:00.000Z');
const birthDate = new Date('1990-05-14T00:00:00.000Z');

describe('BMR / TDEE', () => {
  it('υπολογίζει BMR κατά Mifflin-St Jeor για άνδρα', () => {
    // 10*80 + 6.25*180 - 5*36 + 5 = 1750
    const bmr = calculateBmr({ gender: 'MALE', heightCm: 180, weightKg: 80, birthDate, now });
    expect(bmr).toBe(1750);
  });

  it('υπολογίζει BMR για γυναίκα', () => {
    // 10*65 + 6.25*165 - 5*36 - 161 = 1340.25 -> 1340
    const bmr = calculateBmr({ gender: 'FEMALE', heightCm: 165, weightKg: 65, birthDate, now });
    expect(bmr).toBe(1340);
  });

  it('χρησιμοποιεί μέσο συντελεστή όταν το φύλο δεν δηλώνεται', () => {
    const male = calculateBmr({ gender: 'MALE', heightCm: 170, weightKg: 70, birthDate, now });
    const female = calculateBmr({ gender: 'FEMALE', heightCm: 170, weightKg: 70, birthDate, now });
    const undisclosed = calculateBmr({
      gender: 'UNDISCLOSED',
      heightCm: 170,
      weightKg: 70,
      birthDate,
      now,
    });
    expect(undisclosed).toBeGreaterThan(female);
    expect(undisclosed).toBeLessThan(male);
  });

  it('πολλαπλασιάζει με τον σωστό activity factor', () => {
    expect(calculateTdee(2000, 'SEDENTARY')).toBe(2400);
    expect(calculateTdee(2000, 'VERY_ACTIVE')).toBe(3800);
  });
});

describe('suggestDailyCalorieTarget', () => {
  const base = {
    gender: 'MALE' as const,
    heightCm: 180,
    weightKg: 80,
    birthDate,
    now,
    activityLevel: 'MODERATE' as const,
  };

  it('προτείνει χαμηλότερο στόχο για απώλεια βάρους', () => {
    const lose = suggestDailyCalorieTarget({ ...base, goal: 'LOSE' });
    const maintain = suggestDailyCalorieTarget({ ...base, goal: 'MAINTAIN' });
    const gain = suggestDailyCalorieTarget({ ...base, goal: 'GAIN' });
    expect(lose).toBeLessThan(maintain);
    expect(gain).toBeGreaterThan(maintain);
  });

  it('δεν προτείνει ποτέ επικίνδυνα χαμηλή τιμή', () => {
    const target = suggestDailyCalorieTarget({
      gender: 'FEMALE',
      heightCm: 150,
      weightKg: 45,
      birthDate: new Date('1950-01-01T00:00:00.000Z'),
      now,
      activityLevel: 'SEDENTARY',
      goal: 'LOSE',
    });
    expect(target).toBeGreaterThanOrEqual(800);
  });
});

describe('buildDailySummary', () => {
  it('υπολογίζει υπόλοιπο και ποσοστό', () => {
    const summary = buildDailySummary(1200, 2000);
    expect(summary.remaining).toBe(800);
    expect(summary.progressPercent).toBe(60);
    expect(summary.overTarget).toBe(false);
  });

  it('σημειώνει υπέρβαση στόχου', () => {
    const summary = buildDailySummary(2400, 2000);
    expect(summary.overTarget).toBe(true);
    expect(summary.remaining).toBe(-400);
  });

  it('λειτουργεί χωρίς στόχο', () => {
    const summary = buildDailySummary(1500, null);
    expect(summary.target).toBeNull();
    expect(summary.remaining).toBeNull();
  });

  it('δεν επιστρέφει ποτέ αρνητικές καταναλωμένες θερμίδες', () => {
    expect(buildDailySummary(-50, 2000).consumed).toBe(0);
  });
});

describe('normalizeCalories', () => {
  it('στρογγυλοποιεί σε ακέραιο', () => {
    expect(normalizeCalories(720.6)).toBe(721);
  });

  it('μηδενίζει αρνητικές τιμές', () => {
    expect(normalizeCalories(-10)).toBe(0);
  });

  it('περιορίζει στο απόλυτο μέγιστο', () => {
    expect(normalizeCalories(1_000_000)).toBe(10_000);
  });

  it('χειρίζεται NaN', () => {
    expect(normalizeCalories(Number.NaN)).toBe(0);
  });
});
