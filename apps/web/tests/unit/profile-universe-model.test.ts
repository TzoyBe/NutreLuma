import { describe, expect, it } from 'vitest';
import { buildProfileUniverseModel } from '@/components/profile/profile-universe-model';

describe('buildProfileUniverseModel', () => {
  it('creates a compact identity and health summary', () => {
    expect(buildProfileUniverseModel({
      displayName: 'Ada Lovelace', email: 'ada@example.com', dailyTarget: 1900,
      age: 31, bmi: { value: 22.4, label: 'Healthy' }, currentWeightKg: 64,
      targetWeightKg: 61, activityLevel: 'MODERATE', goal: 'LOSE', planStatus: 'Trial',
    })).toMatchObject({
      displayName: 'Ada Lovelace', email: 'ada@example.com', initials: 'AL',
      dailyTarget: '1900', age: '31', bmi: '22.4', bmiLabel: 'Healthy', planStatus: 'Trial',
      healthSummary: [
        { key: 'currentWeightKg', value: '64', unit: 'kg' },
        { key: 'targetWeightKg', value: '61', unit: 'kg' },
        { key: 'activityLevel', value: 'MODERATE' },
        { key: 'goal', value: 'LOSE' },
      ],
    });
  });

  it.each([
    ['  Ada   Byron Lovelace  ', 'AB'],
    ['Μαρία Παπαδοπούλου', 'ΜΠ'],
    ['Prince', 'P'],
    ['   ', '--'],
  ])('limits initials from %j to two name parts', (displayName, initials) => {
    expect(buildProfileUniverseModel({ displayName, bmi: { value: 22.4, label: 'Healthy' } }).initials).toBe(initials);
  });

  it('uses visible fallbacks when a profile has not been completed', () => {
    expect(buildProfileUniverseModel({})).toEqual({
      displayName: '--', email: '--', initials: '--', dailyTarget: '--', age: '--',
      bmi: '--', bmiLabel: '--', planStatus: '--',
      healthSummary: [
        { key: 'currentWeightKg', value: '--', unit: 'kg' },
        { key: 'targetWeightKg', value: '--', unit: 'kg' },
        { key: 'activityLevel', value: '--' },
        { key: 'goal', value: '--' },
      ],
    });
  });

  it('does not present invalid measurements as real health values', () => {
    expect(buildProfileUniverseModel({
      displayName: '  Ada Lovelace  ', email: '  ada@example.com ', planStatus: ' ',
      dailyTarget: NaN, age: -1, bmi: { value: Infinity, label: 'Healthy' },
      currentWeightKg: 0, targetWeightKg: -20,
    })).toMatchObject({
      displayName: 'Ada Lovelace', email: 'ada@example.com', planStatus: '--',
      dailyTarget: '--', age: '--', bmi: '--', bmiLabel: '--',
      healthSummary: [
        { key: 'currentWeightKg', value: '--' },
        { key: 'targetWeightKg', value: '--' },
        { key: 'activityLevel', value: '--' },
        { key: 'goal', value: '--' },
      ],
    });
  });
});
