import { describe, expect, it } from 'vitest';

import {
  buildNativeGoalUniverse,
  buildNativeProfileUniverse,
} from './personal-universe-model';

describe('buildNativeGoalUniverse', () => {
  it('keeps nullable macro targets explicit and formats journey counts', () => {
    expect(buildNativeGoalUniverse({
      calorieTarget: 2100,
      proteinGrams: 132,
      carbohydrateGrams: null,
      fatGrams: 70,
      achievementsUnlocked: 4,
      achievementsTotal: 12,
      badgesUnlocked: 3,
      activeMilestones: 2,
      historyCount: 6,
    })).toEqual({
      calories: 2100,
      macros: [
        { key: 'protein', label: 'Protein', value: 132, unit: 'g', tone: 'cyan' },
        { key: 'carbohydrate', label: 'Carbs', value: null, unit: 'g', tone: 'gold' },
        { key: 'fat', label: 'Fat', value: 70, unit: 'g', tone: 'violet' },
      ],
      journey: [
        { key: 'achievements', label: 'Achievements', value: '4/12', tone: 'gold' },
        { key: 'badges', label: 'Badges', value: '3', tone: 'violet' },
        { key: 'activeMilestones', label: 'Active goals', value: '2', tone: 'emerald' },
        { key: 'history', label: 'History', value: '6', tone: 'blue' },
      ],
    });
  });
});

describe('buildNativeProfileUniverse', () => {
  it('creates two-letter initials and literal health summary labels', () => {
    expect(buildNativeProfileUniverse({
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      dailyTarget: 1900,
      age: 31,
      bmi: 22.4,
      currentWeightKg: 64,
      targetWeightKg: 61,
      activityLevel: 'MODERATE',
      goal: 'LOSE',
      planStatus: 'Trial',
    })).toEqual({
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      initials: 'AL',
      dailyTarget: '1900',
      age: '31',
      bmi: '22.4',
      planStatus: 'Trial',
      healthSummary: [
        { key: 'currentWeightKg', label: 'Current', value: '64', unit: 'kg', tone: 'cyan' },
        { key: 'targetWeightKg', label: 'Target', value: '61', unit: 'kg', tone: 'violet' },
        { key: 'activityLevel', label: 'Activity', value: 'Moderate', tone: 'emerald' },
        { key: 'goal', label: 'Goal', value: 'Lose', tone: 'blue' },
      ],
    });
  });

  it('uses visible string fallbacks for incomplete profile data', () => {
    expect(buildNativeProfileUniverse({ displayName: '   ' })).toEqual({
      displayName: '--',
      email: '--',
      initials: '--',
      dailyTarget: '--',
      age: '--',
      bmi: '--',
      planStatus: '--',
      healthSummary: [
        { key: 'currentWeightKg', label: 'Current', value: '--', unit: 'kg', tone: 'cyan' },
        { key: 'targetWeightKg', label: 'Target', value: '--', unit: 'kg', tone: 'violet' },
        { key: 'activityLevel', label: 'Activity', value: '--', tone: 'emerald' },
        { key: 'goal', label: 'Goal', value: '--', tone: 'blue' },
      ],
    });
  });
});
