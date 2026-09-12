import { describe, expect, it } from 'vitest';
import { buildHistoryUniverseModel } from '@/components/history/history-universe-model';

describe('buildHistoryUniverseModel', () => {
  it('rounds each kcal total', () => {
    expect(
      buildHistoryUniverseModel({
        dayTotal: 1842.4,
        weekTotal: 12903.9,
        weekAverage: 1843.4,
        monthAverage: 1901.1,
      }),
    ).toEqual({
      hero: 1842,
      satellites: [
        { key: 'weekTotal', value: 12904, unit: 'kcal', tone: 'cyan' },
        { key: 'weekAverage', value: 1843, unit: 'kcal', tone: 'gold' },
        { key: 'monthAverage', value: 1901, unit: 'kcal', tone: 'violet' },
      ],
    });
  });

  it('handles an all-zero day with no meals logged', () => {
    expect(
      buildHistoryUniverseModel({ dayTotal: 0, weekTotal: 0, weekAverage: 0, monthAverage: 0 }),
    ).toEqual({
      hero: 0,
      satellites: [
        { key: 'weekTotal', value: 0, unit: 'kcal', tone: 'cyan' },
        { key: 'weekAverage', value: 0, unit: 'kcal', tone: 'gold' },
        { key: 'monthAverage', value: 0, unit: 'kcal', tone: 'violet' },
      ],
    });
  });
});
