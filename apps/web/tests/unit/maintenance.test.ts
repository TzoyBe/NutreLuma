import { describe, expect, it } from 'vitest';
import {
  unlockToleranceKg,
  computeMaintenanceEligibility,
  suggestMaintenanceRange,
  movingAverage,
  weightVariability,
  daysWithinRange,
  trendDirection,
  classifyStatus,
  computeStabilityScore,
  deriveAlerts,
  deriveRecommendations,
  sustainedThreshold,
} from '@/lib/maintenance';
import type { WeightPoint } from '@/lib/milestone-progress';

/** Βοηθός: σειρά ημερών yyyy-mm-dd ξεκινώντας από startISO. */
function series(startISO: string, values: number[]): WeightPoint[] {
  const start = new Date(`${startISO}T00:00:00.000Z`).getTime();
  return values.map((value, i) => ({
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    value,
  }));
}

describe('unlockToleranceKg', () => {
  it('0.5% of target', () => {
    expect(unlockToleranceKg(120)).toBe(0.6);
    expect(unlockToleranceKg(80)).toBe(0.4);
  });
});

describe('computeMaintenanceEligibility', () => {
  it('no data → not eligible', () => {
    expect(computeMaintenanceEligibility([], 120, 'loss').eligible).toBe(false);
  });

  it('single outlier does NOT unlock (one lone reading at target among higher ones)', () => {
    // Πολλές υψηλές μετρήσεις και μία μεμονωμένη χαμηλή στο τέλος.
    const points = series('2026-08-01', [125, 125, 124.8, 125, 124.9, 120]);
    const res = computeMaintenanceEligibility(points, 120, 'loss');
    expect(res.eligible).toBe(false);
  });

  it('single total reading at target does NOT unlock', () => {
    const points = series('2026-08-06', [120]);
    expect(computeMaintenanceEligibility(points, 120, 'loss').eligible).toBe(false);
  });

  it('7-day moving average reaching target unlocks', () => {
    const points = series('2026-08-02', [120.2, 119.9, 120.0, 119.8, 120.1]);
    const res = computeMaintenanceEligibility(points, 120, 'loss');
    expect(res.eligible).toBe(true);
    expect(res.method).toBe('moving_avg_7d');
  });

  it('two consecutive readings within tolerance unlock (fewer than 3 points)', () => {
    const points = series('2026-08-06', [120.3, 120.1]);
    const res = computeMaintenanceEligibility(points, 120, 'loss');
    expect(res.eligible).toBe(true);
    expect(res.method).toBe('two_consecutive');
  });

  it('respects tolerance: just outside ±0.5% does not unlock via two-consecutive', () => {
    // target 120 → tol 0.6kg. Δύο μετρήσεις στο 121 (πάνω από 120.6) δεν ξεκλειδώνουν.
    const points = series('2026-08-06', [121.0, 121.0]);
    expect(computeMaintenanceEligibility(points, 120, 'loss').eligible).toBe(false);
  });

  it('gain direction unlocks when reaching upward target', () => {
    const points = series('2026-08-06', [79.8, 80.1]);
    const res = computeMaintenanceEligibility(points, 80, 'gain');
    expect(res.eligible).toBe(true);
  });
});

describe('suggestMaintenanceRange', () => {
  it('±1.5 kg default (120 → 118.5–121.5)', () => {
    expect(suggestMaintenanceRange(120)).toEqual({ lower: 118.5, upper: 121.5 });
  });
  it('custom tolerance', () => {
    expect(suggestMaintenanceRange(80, 1)).toEqual({ lower: 79, upper: 81 });
  });
});

describe('movingAverage / variability / daysWithinRange', () => {
  it('averages last N days from latest entry', () => {
    const points = series('2026-08-01', [100, 102, 98, 101, 99]);
    expect(movingAverage(points, 3)).toBe(99.33); // days 3,4,5 => 98,101,99 → 99.33
  });
  it('variability is 0 with <2 points', () => {
    expect(weightVariability(series('2026-08-06', [100]))).toBe(0);
  });
  it('counts entries within range inclusive', () => {
    const points = series('2026-08-01', [118, 120, 122, 119.5, 121.5]);
    expect(daysWithinRange(points, { lower: 118.5, upper: 121.5 })).toBe(3);
  });
});

describe('trendDirection', () => {
  it('stable when noisy but flat', () => {
    const points = series('2026-08-01', [120, 120.1, 119.9, 120, 120.1, 119.95]);
    expect(trendDirection(points).direction).toBe('stable');
  });
  it('up when steadily rising', () => {
    const points = series('2026-08-01', [118, 118.5, 119, 119.5, 120, 120.5]);
    expect(trendDirection(points).direction).toBe('up');
  });
  it('down when steadily falling', () => {
    const points = series('2026-08-01', [122, 121.5, 121, 120.5, 120, 119.5]);
    expect(trendDirection(points).direction).toBe('down');
  });
  it('stable with fewer than 3 points', () => {
    expect(trendDirection(series('2026-08-06', [120, 121])).direction).toBe('stable');
  });
});

describe('classifyStatus', () => {
  const range = { lower: 118.5, upper: 121.5 };
  it('INSUFFICIENT_DATA when avg null', () => {
    expect(classifyStatus(null, range).status).toBe('INSUFFICIENT_DATA');
  });
  it('WITHIN_RANGE at center', () => {
    expect(classifyStatus(120, range).status).toBe('WITHIN_RANGE');
    expect(classifyStatus(120, range).distanceFromCenter).toBe(0);
  });
  it('ABOVE_RANGE and BELOW_RANGE', () => {
    expect(classifyStatus(122, range).status).toBe('ABOVE_RANGE');
    expect(classifyStatus(118, range).status).toBe('BELOW_RANGE');
  });
  it('NEAR_UPPER and NEAR_LOWER within band', () => {
    expect(classifyStatus(121.3, range).status).toBe('NEAR_UPPER');
    expect(classifyStatus(118.7, range).status).toBe('NEAR_LOWER');
  });
});

describe('computeStabilityScore', () => {
  const perfect = {
    daysInRange: 30,
    totalDays: 30,
    weighIns: 12,
    expectedWeighIns: 12,
    loggedDays: 30,
    expectedLogDays: 30,
    calorieAvg: 2000,
    calorieTarget: 2000,
    sustainedDeviationDays: 0,
  };
  it('perfect inputs → 100 with full breakdown', () => {
    const res = computeStabilityScore(perfect);
    expect(res.score).toBe(100);
    expect(res.breakdown).toHaveLength(5);
    expect(res.breakdown.reduce((s, c) => s + c.max, 0)).toBe(100);
  });
  it('is deterministic', () => {
    expect(computeStabilityScore(perfect)).toEqual(computeStabilityScore(perfect));
  });
  it('does not penalize a single deviation day (0 sustained)', () => {
    const withOneOffDay = { ...perfect, daysInRange: 29 };
    // ένας εκτός range δεν μηδενίζει· χάνει μικρό κλάσμα μόνο του inRange component
    const res = computeStabilityScore(withOneOffDay);
    expect(res.score).toBeGreaterThanOrEqual(98);
  });
  it('missing calorie data zeroes only that component', () => {
    const res = computeStabilityScore({ ...perfect, calorieAvg: null });
    expect(res.breakdown.find((c) => c.key === 'calorie')!.points).toBe(0);
    expect(res.score).toBe(85);
  });
});

describe('deriveAlerts', () => {
  const base = {
    dayISO: '2026-08-08',
    status: 'WITHIN_RANGE' as const,
    sustainedAboveDays: 0,
    sustainedBelowDays: 0,
    weighInsLast7: 4,
    expectedWeighInsLast7: 4,
    trend: 'stable' as const,
    trendDays: 0,
  };
  it('no alerts when everything is fine', () => {
    expect(deriveAlerts(base, 'MEDIUM')).toHaveLength(0);
  });
  it('never alerts from a single measurement (1 day above < threshold)', () => {
    expect(deriveAlerts({ ...base, sustainedAboveDays: 1, status: 'ABOVE_RANGE' }, 'MEDIUM')).toHaveLength(
      0,
    );
  });
  it('above-range sustained beyond threshold → ATTENTION', () => {
    const alerts = deriveAlerts({ ...base, sustainedAboveDays: 5, status: 'ABOVE_RANGE' }, 'MEDIUM');
    expect(alerts[0]!.type).toBe('ABOVE_RANGE_SUSTAINED');
    expect(alerts[0]!.severity).toBe('ATTENTION');
  });
  it('below-range sustained beyond threshold', () => {
    const alerts = deriveAlerts({ ...base, sustainedBelowDays: 6, status: 'BELOW_RANGE' }, 'MEDIUM');
    expect(alerts.some((a) => a.type === 'BELOW_RANGE_SUSTAINED')).toBe(true);
  });
  it('approaching upper gives a gentle INFO', () => {
    const alerts = deriveAlerts({ ...base, status: 'NEAR_UPPER' }, 'MEDIUM');
    expect(alerts[0]!.type).toBe('APPROACHING_UPPER');
    expect(alerts[0]!.severity).toBe('INFO');
  });
  it('insufficient weigh-ins short-circuits other weight alerts', () => {
    const alerts = deriveAlerts({ ...base, weighInsLast7: 1, sustainedAboveDays: 9 }, 'MEDIUM');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe('INSUFFICIENT_WEIGH_INS');
  });
  it('sensitivity changes the sustained threshold', () => {
    expect(sustainedThreshold('HIGH')).toBe(3);
    expect(sustainedThreshold('MEDIUM')).toBe(5);
    expect(sustainedThreshold('LOW')).toBe(7);
    // 4 ημέρες: HIGH ειδοποιεί, LOW όχι
    expect(deriveAlerts({ ...base, sustainedAboveDays: 4, status: 'ABOVE_RANGE' }, 'HIGH').length).toBe(
      1,
    );
    expect(deriveAlerts({ ...base, sustainedAboveDays: 4, status: 'ABOVE_RANGE' }, 'LOW').length).toBe(
      0,
    );
  });
  it('messages avoid judgmental language', () => {
    const alerts = deriveAlerts({ ...base, sustainedAboveDays: 5, status: 'ABOVE_RANGE' }, 'MEDIUM');
    const banned = ['failed', 'gained too much', 'must diet', 'ruined'];
    for (const a of alerts) {
      for (const word of banned) expect(a.message.toLowerCase()).not.toContain(word);
    }
  });
});

describe('deriveRecommendations', () => {
  it('poor logging → improve logging first', () => {
    const recs = deriveRecommendations({
      status: 'WITHIN_RANGE',
      loggedDays: 2,
      expectedLogDays: 7,
      trend: 'stable',
    });
    expect(recs[0]!.key).toBe('improve_logging');
  });
  it('steady within range → keep target', () => {
    const recs = deriveRecommendations({
      status: 'WITHIN_RANGE',
      loggedDays: 7,
      expectedLogDays: 7,
      trend: 'stable',
    });
    expect(recs[0]!.key).toBe('keep_target');
  });
  it('above range → monitor + small adjustment (no auto change)', () => {
    const recs = deriveRecommendations({
      status: 'ABOVE_RANGE',
      loggedDays: 7,
      expectedLogDays: 7,
      trend: 'up',
    });
    expect(recs.map((r) => r.key)).toContain('small_adjustment');
    expect(recs.map((r) => r.key)).toContain('monitor_week');
  });
});
