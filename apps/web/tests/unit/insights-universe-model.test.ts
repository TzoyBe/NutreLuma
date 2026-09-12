import { describe, expect, it } from 'vitest';
import { buildInsightsUniverseModel } from '@/components/insights/insights-universe-model';

describe('buildInsightsUniverseModel', () => {
  it('builds the hero and all three satellites when energy data exists', () => {
    expect(
      buildInsightsUniverseModel({
        calibrationScore: 82,
        qualityScore: 64,
        correctionRate30d: 12,
        energyConfidencePercent: 71,
      }),
    ).toEqual({
      hero: 82,
      satellites: [
        { key: 'dataConfidence', value: 64, unit: '%', tone: 'cyan' },
        { key: 'correctionRate', value: 12, unit: '%', tone: 'gold' },
        { key: 'energyConfidence', value: 71, unit: '%', tone: 'violet' },
      ],
    });
  });

  it('falls back to "--" with no unit when quality or energy data is missing', () => {
    const model = buildInsightsUniverseModel({
      calibrationScore: 0,
      qualityScore: null,
      correctionRate30d: 0,
      energyConfidencePercent: null,
    });
    expect(model.satellites[0]).toEqual({ key: 'dataConfidence', value: '--', unit: undefined, tone: 'cyan' });
    expect(model.satellites[2]).toEqual({ key: 'energyConfidence', value: '--', unit: undefined, tone: 'violet' });
  });
});
