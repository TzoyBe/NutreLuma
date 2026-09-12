export interface InsightsUniverseInput {
  calibrationScore: number;
  qualityScore: number | null;
  correctionRate30d: number;
  energyConfidencePercent: number | null;
}

export interface InsightsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'dataConfidence' | 'correctionRate' | 'energyConfidence';
    value: number | string;
    unit?: '%';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
}

export function buildInsightsUniverseModel(input: InsightsUniverseInput): InsightsUniverseModel {
  return {
    hero: input.calibrationScore,
    satellites: [
      {
        key: 'dataConfidence',
        value: input.qualityScore ?? '--',
        unit: input.qualityScore === null ? undefined : '%',
        tone: 'cyan',
      },
      { key: 'correctionRate', value: input.correctionRate30d, unit: '%', tone: 'gold' },
      {
        key: 'energyConfidence',
        value: input.energyConfidencePercent ?? '--',
        unit: input.energyConfidencePercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}
