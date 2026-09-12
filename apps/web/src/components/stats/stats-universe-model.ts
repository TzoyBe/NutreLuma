export interface StatsUniverseInput {
  average7: number;
  average30: number;
  weekTotal: number;
  daysWithinTargetPercent: number | null;
}

export interface StatsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'average30' | 'weekTotal' | 'daysWithinTarget';
    value: number | string;
    unit?: 'kcal' | '%';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
}

export function buildStatsUniverseModel(input: StatsUniverseInput): StatsUniverseModel {
  return {
    hero: Math.round(input.average7),
    satellites: [
      { key: 'average30', value: Math.round(input.average30), unit: 'kcal', tone: 'cyan' },
      { key: 'weekTotal', value: Math.round(input.weekTotal), unit: 'kcal', tone: 'gold' },
      {
        key: 'daysWithinTarget',
        value: input.daysWithinTargetPercent ?? '--',
        unit: input.daysWithinTargetPercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}
