import { describe, expect, it } from 'vitest';

import { buildAuroraSummary, safeProgress } from '@/components/dashboard/aurora-dashboard-model';

describe('safeProgress', () => {
  it.each([
    { current: 42, target: 100, expected: 0.42 },
    { current: 140, target: 100, expected: 1 },
    { current: -5, target: 100, expected: 0 },
    { current: 10, target: null, expected: 0 },
    { current: 10, target: 0, expected: 0 },
  ])('returns $expected for $current / $target', ({ current, target, expected }) => {
    expect(safeProgress(current, target)).toBe(expected);
  });
});

describe('buildAuroraSummary', () => {
  it('keeps the real over-target percentage in the message', () => {
    expect(buildAuroraSummary(2450, 2000)).toBe(
      "You're at 123% of your daily goal. You've moved beyond today's target — choose what feels nourishing next.",
    );
  });

  it('prompts for goals when no calorie target exists', () => {
    expect(buildAuroraSummary(0, null)).toBe('Set your daily goals to light up your progress.');
  });
});
