import { describe, expect, it } from 'vitest';
import { expectedMealTypeForHour, frequencyScore } from '@/lib/meal-ranking';

describe('expectedMealTypeForHour', () => {
  it('maps time of day to meal type', () => {
    expect(expectedMealTypeForHour(8)).toBe('BREAKFAST');
    expect(expectedMealTypeForHour(13)).toBe('LUNCH');
    expect(expectedMealTypeForHour(20)).toBe('DINNER');
    expect(expectedMealTypeForHour(3)).toBe('OTHER');
  });
});

describe('frequencyScore', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  it('rewards higher usage count', () => {
    const a = frequencyScore({ usageCount: 10, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'OTHER');
    const b = frequencyScore({ usageCount: 2, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'OTHER');
    expect(a).toBeGreaterThan(b);
  });
  it('decays with recency (older = lower)', () => {
    const recent = frequencyScore({ usageCount: 5, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'OTHER');
    const old = frequencyScore(
      { usageCount: 5, lastUsedAt: new Date('2026-07-01T12:00:00Z'), groupMealType: 'LUNCH' }, now, 'OTHER');
    expect(recent).toBeGreaterThan(old);
  });
  it('boosts meals matching the expected type for now', () => {
    const match = frequencyScore({ usageCount: 5, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'LUNCH');
    const noMatch = frequencyScore({ usageCount: 5, lastUsedAt: now, groupMealType: 'DINNER' }, now, 'LUNCH');
    expect(match).toBeGreaterThan(noMatch);
  });
});
