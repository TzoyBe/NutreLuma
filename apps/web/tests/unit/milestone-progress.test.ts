import { describe, expect, it } from 'vitest';
import {
  milestonePercent,
  remainingAmount,
  resolveWeightCurrent,
  isWeightGoalReached,
  impliedWeeklyRateKg,
  isAggressiveWeeklyRate,
  longestConsecutiveStreak,
  countDistinctDays,
} from '@/lib/milestone-progress';

describe('milestonePercent', () => {
  it('weight-loss example: 131→129, current 130.2 = 40%', () => {
    expect(milestonePercent(131, 130.2, 129)).toBe(40);
  });
  it('count goal 0→7, current 3 ≈ 43%', () => {
    expect(milestonePercent(0, 3, 7)).toBe(43);
  });
  it('clamps to 0..100', () => {
    expect(milestonePercent(0, -5, 7)).toBe(0);
    expect(milestonePercent(0, 99, 7)).toBe(100);
    expect(milestonePercent(131, 128, 129)).toBe(100); // overshoot loss
  });
  it('handles start==target (already there / not)', () => {
    expect(milestonePercent(5, 5, 5)).toBe(100);
    expect(milestonePercent(5, 4, 5)).toBe(0);
  });
});

describe('remainingAmount', () => {
  it('is absolute distance to target', () => {
    expect(remainingAmount(130.2, 129)).toBe(1.2);
    expect(remainingAmount(3, 7)).toBe(4);
  });
});

describe('resolveWeightCurrent', () => {
  const pts = (arr: Array<[string, number]>) => arr.map(([date, value]) => ({ date, value }));
  it('uses 7-day moving average when >=3 recent entries', () => {
    const r = resolveWeightCurrent(
      pts([
        ['2026-08-01', 131],
        ['2026-08-03', 130.5],
        ['2026-08-05', 130],
      ]),
    );
    expect(r?.method).toBe('moving_avg_7d');
    expect(r?.value).toBeCloseTo(130.5, 5);
  });
  it('falls back to latest entry when <3 recent', () => {
    const r = resolveWeightCurrent(pts([['2026-08-05', 130.2]]));
    expect(r?.method).toBe('latest_entry');
    expect(r?.value).toBe(130.2);
  });
  it('ignores entries older than the 7-day window from the latest', () => {
    const r = resolveWeightCurrent(
      pts([
        ['2026-07-01', 140], // far outside window → excluded
        ['2026-08-05', 130],
      ]),
    );
    // only 1 within window → latest_entry
    expect(r?.method).toBe('latest_entry');
    expect(r?.value).toBe(130);
  });
  it('returns null with no entries', () => {
    expect(resolveWeightCurrent([])).toBeNull();
  });
});

describe('isWeightGoalReached', () => {
  const pts = (arr: Array<[string, number]>) => arr.map(([date, value]) => ({ date, value }));
  it('does NOT complete from a single outlier when history exists', () => {
    const r = isWeightGoalReached(
      pts([
        ['2026-08-01', 131],
        ['2026-08-03', 130.6],
        ['2026-08-05', 128.9], // one dip to target, but avg still ~130.2
      ]),
      129,
      'loss',
    );
    expect(r.reached).toBe(false);
  });
  it('completes when moving average reaches target', () => {
    const r = isWeightGoalReached(
      pts([
        ['2026-08-01', 129.2],
        ['2026-08-03', 129],
        ['2026-08-05', 128.8],
      ]),
      129,
      'loss',
    );
    expect(r.reached).toBe(true);
  });
  it('completes on two consecutive entries near target', () => {
    const r = isWeightGoalReached(
      pts([
        ['2026-08-01', 131],
        ['2026-08-04', 128.95],
        ['2026-08-05', 128.9],
      ]),
      129,
      'loss',
    );
    expect(r.reached).toBe(true);
    expect(r.method).toBe('two_consecutive');
  });
  it('handles gain direction', () => {
    const r = isWeightGoalReached(
      pts([
        ['2026-08-04', 70.1],
        ['2026-08-05', 70.2],
      ]),
      70,
      'gain',
    );
    expect(r.reached).toBe(true);
  });
});

describe('impliedWeeklyRateKg / isAggressiveWeeklyRate', () => {
  it('computes kg per week', () => {
    const rate = impliedWeeklyRateKg(131, 129, new Date('2026-08-01'), new Date('2026-08-15'));
    expect(rate).toBeCloseTo(1, 5); // 2 kg / 2 weeks
  });
  it('flags aggressive when > 1 kg/week', () => {
    expect(isAggressiveWeeklyRate(1.5)).toBe(true);
    expect(isAggressiveWeeklyRate(0.5)).toBe(false);
  });
});

describe('day counting helpers', () => {
  it('longestConsecutiveStreak finds the longest run of distinct days', () => {
    expect(
      longestConsecutiveStreak(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-05']),
    ).toBe(3);
    expect(longestConsecutiveStreak(['2026-08-05', '2026-08-05'])).toBe(1);
    expect(longestConsecutiveStreak([])).toBe(0);
  });
  it('countDistinctDays dedupes', () => {
    expect(countDistinctDays(['2026-08-01', '2026-08-01', '2026-08-02'])).toBe(2);
  });
});
