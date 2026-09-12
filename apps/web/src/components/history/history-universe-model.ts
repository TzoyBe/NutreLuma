export interface HistoryUniverseInput {
  dayTotal: number;
  weekTotal: number;
  weekAverage: number;
  monthAverage: number;
}

export interface HistoryUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'weekTotal' | 'weekAverage' | 'monthAverage';
    value: number;
    unit: 'kcal';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
}

export function buildHistoryUniverseModel(input: HistoryUniverseInput): HistoryUniverseModel {
  return {
    hero: Math.round(input.dayTotal),
    satellites: [
      { key: 'weekTotal', value: Math.round(input.weekTotal), unit: 'kcal', tone: 'cyan' },
      { key: 'weekAverage', value: Math.round(input.weekAverage), unit: 'kcal', tone: 'gold' },
      { key: 'monthAverage', value: Math.round(input.monthAverage), unit: 'kcal', tone: 'violet' },
    ],
  };
}
