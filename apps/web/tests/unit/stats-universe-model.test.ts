import { describe, expect, it } from 'vitest';
import { buildStatsUniverseModel } from '@/components/stats/stats-universe-model';

describe('buildStatsUniverseModel', () => {
  it('rounds averages and formats the within-target percent', () => {
    expect(
      buildStatsUniverseModel({
        average7: 2103.6,
        average30: 1987.2,
        weekTotal: 14725,
        daysWithinTargetPercent: 71,
      }),
    ).toEqual({
      hero: 2104,
      satellites: [
        { key: 'average30', value: 1987, unit: 'kcal', tone: 'cyan' },
        { key: 'weekTotal', value: 14725, unit: 'kcal', tone: 'gold' },
        { key: 'daysWithinTarget', value: 71, unit: '%', tone: 'violet' },
      ],
    });
  });

  it('falls back to "--" with no unit when the within-target percent is null', () => {
    const model = buildStatsUniverseModel({
      average7: 0,
      average30: 0,
      weekTotal: 0,
      daysWithinTargetPercent: null,
    });
    expect(model.satellites[2]).toEqual({
      key: 'daysWithinTarget',
      value: '--',
      unit: undefined,
      tone: 'violet',
    });
  });
});
