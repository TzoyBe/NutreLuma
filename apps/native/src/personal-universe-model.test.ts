import { describe, expect, it } from 'vitest';

import {
  buildNativeGoalUniverse,
  buildNativeProfileUniverse,
  buildNativeStatsUniverse,
  buildNativeHistoryUniverse,
  buildNativeInsightsUniverse,
  buildNativeProgressUniverse,
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

describe('buildNativeStatsUniverse', () => {
  it('rounds averages and labels the within-target percent', () => {
    expect(
      buildNativeStatsUniverse({
        average7: 2103.6,
        average30: 1987.2,
        weekTotal: 14725,
        daysWithinTargetPercent: 71,
      }),
    ).toEqual({
      hero: 2104,
      satellites: [
        { key: 'average30', label: 'Avg 30', value: '1987', unit: 'kcal', tone: 'cyan' },
        { key: 'weekTotal', label: 'Week total', value: '14725', unit: 'kcal', tone: 'gold' },
        { key: 'daysWithinTarget', label: 'Within target', value: '71', unit: '%', tone: 'violet' },
      ],
    });
  });

  it('shows "--" with no unit when the within-target percent is null', () => {
    const model = buildNativeStatsUniverse({
      average7: 0,
      average30: 0,
      weekTotal: 0,
      daysWithinTargetPercent: null,
    });
    expect(model.satellites[2]).toEqual({
      key: 'daysWithinTarget',
      label: 'Within target',
      value: '--',
      unit: undefined,
      tone: 'violet',
    });
  });
});

describe('buildNativeHistoryUniverse', () => {
  it('rounds each kcal total', () => {
    expect(
      buildNativeHistoryUniverse({
        dayTotal: 1842.4,
        weekTotal: 12903.9,
        weekAverage: 1843.4,
        monthAverage: 1901.1,
      }),
    ).toEqual({
      hero: 1842,
      satellites: [
        { key: 'weekTotal', label: 'Week total', value: '12904', unit: 'kcal', tone: 'cyan' },
        { key: 'weekAverage', label: 'Week avg', value: '1843', unit: 'kcal', tone: 'gold' },
        { key: 'monthAverage', label: 'Month avg', value: '1901', unit: 'kcal', tone: 'violet' },
      ],
    });
  });
});

describe('buildNativeInsightsUniverse', () => {
  it('builds the hero and all three satellites when energy data exists', () => {
    expect(
      buildNativeInsightsUniverse({
        calibrationScore: 82,
        qualityScore: 64,
        correctionRate30d: 12,
        energyConfidencePercent: 71,
      }),
    ).toEqual({
      hero: 82,
      satellites: [
        { key: 'dataConfidence', label: 'Data confidence', value: '64', unit: '%', tone: 'cyan' },
        { key: 'correctionRate', label: '30d corrections', value: '12', unit: '%', tone: 'gold' },
        { key: 'energyConfidence', label: 'Energy confidence', value: '71', unit: '%', tone: 'violet' },
      ],
    });
  });

  it('shows "--" with no unit when quality or energy data is missing', () => {
    const model = buildNativeInsightsUniverse({
      calibrationScore: 0,
      qualityScore: null,
      correctionRate30d: 0,
      energyConfidencePercent: null,
    });
    expect(model.satellites[0]).toEqual({
      key: 'dataConfidence',
      label: 'Data confidence',
      value: '--',
      unit: undefined,
      tone: 'cyan',
    });
    expect(model.satellites[2]).toEqual({
      key: 'energyConfidence',
      label: 'Energy confidence',
      value: '--',
      unit: undefined,
      tone: 'violet',
    });
  });
});

describe('buildNativeProgressUniverse', () => {
  it('computes a positive delta (above target) and rounds to one decimal', () => {
    expect(
      buildNativeProgressUniverse({
        currentWeightKg: 82.34,
        targetWeightKg: 78,
        weekTotalKcal: 13020,
        avg7Kcal: 2103.6,
        calibrationScore: 82,
      }),
    ).toEqual({
      heroDeltaKg: 4.3,
      satellites: [
        { key: 'history', label: 'This week', value: '13020', unit: 'kcal', tone: 'cyan' },
        { key: 'stats', label: '7-day avg', value: '2104', unit: 'kcal', tone: 'gold' },
        { key: 'insights', label: 'Calibration', value: '82', unit: '%', tone: 'violet' },
      ],
    });
  });

  it('returns a null delta when weight or target data is missing', () => {
    const model = buildNativeProgressUniverse({
      currentWeightKg: null,
      targetWeightKg: 78,
      weekTotalKcal: 0,
      avg7Kcal: 0,
      calibrationScore: 0,
    });
    expect(model.heroDeltaKg).toBeNull();
  });
});
