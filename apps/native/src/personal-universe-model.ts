export type NativeUniverseTone = 'cyan' | 'gold' | 'violet' | 'emerald' | 'blue';

export interface NativeGoalUniverseInput {
  calorieTarget: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  achievementsUnlocked: number;
  achievementsTotal: number;
  badgesUnlocked: number;
  activeMilestones: number;
  historyCount: number;
}

export interface NativeGoalUniverseModel {
  calories: number | null;
  macros: Array<{
    key: 'protein' | 'carbohydrate' | 'fat';
    label: string;
    value: number | null;
    unit: 'g';
    tone: NativeUniverseTone;
  }>;
  journey: Array<{
    key: 'achievements' | 'badges' | 'activeMilestones' | 'history';
    label: string;
    value: string;
    tone: NativeUniverseTone;
  }>;
}

export interface NativeProfileUniverseInput {
  displayName?: string | null;
  email?: string | null;
  dailyTarget?: number | null;
  age?: number | null;
  bmi?: number | null;
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  activityLevel?: string | null;
  goal?: string | null;
  planStatus?: string | null;
}

export interface NativeProfileUniverseModel {
  displayName: string;
  email: string;
  initials: string;
  dailyTarget: string;
  age: string;
  bmi: string;
  planStatus: string;
  healthSummary: Array<{
    key: 'currentWeightKg' | 'targetWeightKg' | 'activityLevel' | 'goal';
    label: string;
    value: string;
    unit?: 'kg';
    tone: NativeUniverseTone;
  }>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  SEDENTARY: 'Low',
  LIGHT: 'Light',
  MODERATE: 'Moderate',
  ACTIVE: 'Active',
  VERY_ACTIVE: 'Very active',
};

const GOAL_LABELS: Record<string, string> = {
  LOSE: 'Lose',
  MAINTAIN: 'Maintain',
  GAIN: 'Gain',
};

function numberLabel(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? String(value)
    : '--';
}

export function buildNativeGoalUniverse(
  input: NativeGoalUniverseInput,
): NativeGoalUniverseModel {
  return {
    calories: input.calorieTarget,
    macros: [
      { key: 'protein', label: 'Protein', value: input.proteinGrams, unit: 'g', tone: 'cyan' },
      {
        key: 'carbohydrate',
        label: 'Carbs',
        value: input.carbohydrateGrams,
        unit: 'g',
        tone: 'gold',
      },
      { key: 'fat', label: 'Fat', value: input.fatGrams, unit: 'g', tone: 'violet' },
    ],
    journey: [
      {
        key: 'achievements',
        label: 'Achievements',
        value: `${input.achievementsUnlocked}/${input.achievementsTotal}`,
        tone: 'gold',
      },
      { key: 'badges', label: 'Badges', value: `${input.badgesUnlocked}`, tone: 'violet' },
      {
        key: 'activeMilestones',
        label: 'Active goals',
        value: `${input.activeMilestones}`,
        tone: 'emerald',
      },
      { key: 'history', label: 'History', value: `${input.historyCount}`, tone: 'blue' },
    ],
  };
}

export interface NativeRecipeUniverseInput {
  hasPlan: boolean;
  plannedCalories: number;
  plannedProteinGrams: number;
  plannedCarbohydrateGrams: number;
  plannedFatGrams: number;
  mealsPlanned: number;
  savedCount: number;
}

export interface NativeRecipeUniverseModel {
  calories: number | null;
  macros: Array<{
    key: 'protein' | 'carbohydrate' | 'fat';
    label: string;
    value: number | null;
    unit: 'g';
    tone: NativeUniverseTone;
  }>;
  journey: { mealsPlanned: string; saved: string };
}

export function buildNativeRecipeUniverse(
  input: NativeRecipeUniverseInput,
): NativeRecipeUniverseModel {
  return {
    calories: input.hasPlan ? Math.round(input.plannedCalories) : null,
    macros: [
      {
        key: 'protein',
        label: 'Protein',
        value: input.hasPlan ? Math.round(input.plannedProteinGrams) : null,
        unit: 'g',
        tone: 'cyan',
      },
      {
        key: 'carbohydrate',
        label: 'Carbs',
        value: input.hasPlan ? Math.round(input.plannedCarbohydrateGrams) : null,
        unit: 'g',
        tone: 'gold',
      },
      {
        key: 'fat',
        label: 'Fat',
        value: input.hasPlan ? Math.round(input.plannedFatGrams) : null,
        unit: 'g',
        tone: 'violet',
      },
    ],
    journey: {
      mealsPlanned: String(input.mealsPlanned),
      saved: String(input.savedCount),
    },
  };
}

export function buildNativeProfileUniverse(
  input: NativeProfileUniverseInput,
): NativeProfileUniverseModel {
  const displayName = input.displayName?.trim() || '--';

  return {
    displayName,
    email: input.email?.trim() || '--',
    initials: displayName === '--'
      ? '--'
      : displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((name) => Array.from(name)[0])
          .join('')
          .toUpperCase(),
    dailyTarget: numberLabel(input.dailyTarget),
    age: numberLabel(input.age),
    bmi: numberLabel(input.bmi),
    planStatus: input.planStatus?.trim() || '--',
    healthSummary: [
      {
        key: 'currentWeightKg',
        label: 'Current',
        value: numberLabel(input.currentWeightKg),
        unit: 'kg',
        tone: 'cyan',
      },
      {
        key: 'targetWeightKg',
        label: 'Target',
        value: numberLabel(input.targetWeightKg),
        unit: 'kg',
        tone: 'violet',
      },
      {
        key: 'activityLevel',
        label: 'Activity',
        value: input.activityLevel ? ACTIVITY_LABELS[input.activityLevel] ?? '--' : '--',
        tone: 'emerald',
      },
      {
        key: 'goal',
        label: 'Goal',
        value: input.goal ? GOAL_LABELS[input.goal] ?? '--' : '--',
        tone: 'blue',
      },
    ],
  };
}

export interface NativeStatsUniverseInput {
  average7: number;
  average30: number;
  weekTotal: number;
  daysWithinTargetPercent: number | null;
}

export interface NativeStatsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'average30' | 'weekTotal' | 'daysWithinTarget';
    label: string;
    value: string;
    unit?: string;
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeStatsUniverse(input: NativeStatsUniverseInput): NativeStatsUniverseModel {
  return {
    hero: Math.round(input.average7),
    satellites: [
      { key: 'average30', label: 'Avg 30', value: `${Math.round(input.average30)}`, unit: 'kcal', tone: 'cyan' },
      { key: 'weekTotal', label: 'Week total', value: `${Math.round(input.weekTotal)}`, unit: 'kcal', tone: 'gold' },
      {
        key: 'daysWithinTarget',
        label: 'Within target',
        value: input.daysWithinTargetPercent === null ? '--' : `${input.daysWithinTargetPercent}`,
        unit: input.daysWithinTargetPercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}

export interface NativeHistoryUniverseInput {
  dayTotal: number;
  weekTotal: number;
  weekAverage: number;
  monthAverage: number;
}

export interface NativeHistoryUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'weekTotal' | 'weekAverage' | 'monthAverage';
    label: string;
    value: string;
    unit: 'kcal';
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeHistoryUniverse(input: NativeHistoryUniverseInput): NativeHistoryUniverseModel {
  return {
    hero: Math.round(input.dayTotal),
    satellites: [
      { key: 'weekTotal', label: 'Week total', value: `${Math.round(input.weekTotal)}`, unit: 'kcal', tone: 'cyan' },
      { key: 'weekAverage', label: 'Week avg', value: `${Math.round(input.weekAverage)}`, unit: 'kcal', tone: 'gold' },
      { key: 'monthAverage', label: 'Month avg', value: `${Math.round(input.monthAverage)}`, unit: 'kcal', tone: 'violet' },
    ],
  };
}

export interface NativeInsightsUniverseInput {
  calibrationScore: number;
  qualityScore: number | null;
  correctionRate30d: number;
  energyConfidencePercent: number | null;
}

export interface NativeInsightsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'dataConfidence' | 'correctionRate' | 'energyConfidence';
    label: string;
    value: string;
    unit?: string;
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeInsightsUniverse(input: NativeInsightsUniverseInput): NativeInsightsUniverseModel {
  return {
    hero: input.calibrationScore,
    satellites: [
      {
        key: 'dataConfidence',
        label: 'Data confidence',
        value: input.qualityScore === null ? '--' : `${input.qualityScore}`,
        unit: input.qualityScore === null ? undefined : '%',
        tone: 'cyan',
      },
      { key: 'correctionRate', label: '30d corrections', value: `${input.correctionRate30d}`, unit: '%', tone: 'gold' },
      {
        key: 'energyConfidence',
        label: 'Energy confidence',
        value: input.energyConfidencePercent === null ? '--' : `${input.energyConfidencePercent}`,
        unit: input.energyConfidencePercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}

export interface NativeProgressUniverseInput {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weekTotalKcal: number;
  avg7Kcal: number;
  calibrationScore: number;
}

export interface NativeProgressUniverseModel {
  heroDeltaKg: number | null;
  satellites: Array<{
    key: 'history' | 'stats' | 'insights';
    label: string;
    value: string;
    unit?: string;
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeProgressUniverse(input: NativeProgressUniverseInput): NativeProgressUniverseModel {
  const heroDeltaKg =
    input.currentWeightKg !== null && input.targetWeightKg !== null
      ? Math.round((input.currentWeightKg - input.targetWeightKg) * 10) / 10
      : null;

  return {
    heroDeltaKg,
    satellites: [
      { key: 'history', label: 'This week', value: `${Math.round(input.weekTotalKcal)}`, unit: 'kcal', tone: 'cyan' },
      { key: 'stats', label: '7-day avg', value: `${Math.round(input.avg7Kcal)}`, unit: 'kcal', tone: 'gold' },
      { key: 'insights', label: 'Calibration', value: `${input.calibrationScore}`, unit: '%', tone: 'violet' },
    ],
  };
}
