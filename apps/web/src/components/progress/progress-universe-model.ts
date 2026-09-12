export interface ProgressUniverseInput {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weekTotalKcal: number;
  avg7Kcal: number;
  calibrationScore: number;
}

export interface ProgressUniverseModel {
  heroDeltaKg: number | null;
  satellites: Array<{
    key: 'history' | 'stats' | 'insights';
    value: number;
    unit: 'kcal' | '%';
    tone: 'cyan' | 'gold' | 'violet';
    href: string;
  }>;
}

export function buildProgressUniverseModel(input: ProgressUniverseInput): ProgressUniverseModel {
  const heroDeltaKg =
    input.currentWeightKg !== null && input.targetWeightKg !== null
      ? Math.round((input.currentWeightKg - input.targetWeightKg) * 10) / 10
      : null;

  return {
    heroDeltaKg,
    satellites: [
      { key: 'history', value: Math.round(input.weekTotalKcal), unit: 'kcal', tone: 'cyan', href: '/history' },
      { key: 'stats', value: Math.round(input.avg7Kcal), unit: 'kcal', tone: 'gold', href: '/stats' },
      { key: 'insights', value: input.calibrationScore, unit: '%', tone: 'violet', href: '/insights' },
    ],
  };
}
