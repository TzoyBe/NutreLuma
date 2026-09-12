import { describe, expect, it } from 'vitest';
import { buildProgressUniverseModel } from '@/components/progress/progress-universe-model';

describe('buildProgressUniverseModel', () => {
  it('computes a positive delta (above target) and rounds to one decimal', () => {
    expect(
      buildProgressUniverseModel({
        currentWeightKg: 82.34,
        targetWeightKg: 78,
        weekTotalKcal: 13020,
        avg7Kcal: 2103.6,
        calibrationScore: 82,
      }),
    ).toEqual({
      heroDeltaKg: 4.3,
      satellites: [
        { key: 'history', value: 13020, unit: 'kcal', tone: 'cyan', href: '/history' },
        { key: 'stats', value: 2104, unit: 'kcal', tone: 'gold', href: '/stats' },
        { key: 'insights', value: 82, unit: '%', tone: 'violet', href: '/insights' },
      ],
    });
  });

  it('returns a null delta when weight or target data is missing', () => {
    const model = buildProgressUniverseModel({
      currentWeightKg: null,
      targetWeightKg: 78,
      weekTotalKcal: 0,
      avg7Kcal: 0,
      calibrationScore: 0,
    });
    expect(model.heroDeltaKg).toBeNull();
  });
});
