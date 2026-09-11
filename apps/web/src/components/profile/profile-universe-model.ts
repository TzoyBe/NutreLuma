import type { ACTIVITY_LEVELS, GOALS } from '@/lib/constants';

export interface ProfileUniverseInput {
  displayName?: string | null;
  email?: string | null;
  dailyTarget?: number | null;
  age?: number | null;
  bmi?: { value: number; label: string } | null;
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  activityLevel?: (typeof ACTIVITY_LEVELS)[number] | null;
  goal?: (typeof GOALS)[number] | null;
  planStatus?: string | null;
}

export interface ProfileUniverseModel {
  displayName: string;
  email: string;
  initials: string;
  dailyTarget: string;
  age: string;
  bmi: string;
  bmiLabel: string;
  planStatus: string;
  healthSummary: Array<{
    key: 'currentWeightKg' | 'targetWeightKg' | 'activityLevel' | 'goal';
    value: string;
    unit?: string;
  }>;
}

export function buildProfileUniverseModel(input: ProfileUniverseInput): ProfileUniverseModel {
  const displayName = input.displayName?.trim() || '--';
  const numberLabel = (value: number | null | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(value) : '--';
  const bmi = numberLabel(input.bmi?.value);

  return {
    displayName,
    email: input.email?.trim() || '--',
    initials: displayName === '--' ? '--' : displayName.split(/\s+/).slice(0, 2)
      .map((name) => Array.from(name)[0]).join('').toUpperCase(),
    dailyTarget: numberLabel(input.dailyTarget),
    age: numberLabel(input.age),
    bmi,
    bmiLabel: bmi === '--' ? '--' : input.bmi?.label.trim() || '--',
    planStatus: input.planStatus?.trim() || '--',
    healthSummary: [
      { key: 'currentWeightKg', value: numberLabel(input.currentWeightKg), unit: 'kg' },
      { key: 'targetWeightKg', value: numberLabel(input.targetWeightKg), unit: 'kg' },
      { key: 'activityLevel', value: input.activityLevel ?? '--' },
      { key: 'goal', value: input.goal ?? '--' },
    ],
  };
}
