import { describe, expect, it } from 'vitest';
import { getDashboardFit } from './dashboard-layout';

describe('getDashboardFit', () => {
  it('keeps photo meal cards stable while the flexible dashboard height settles', () => {
    expect(getDashboardFit(null).mealCardScale).toBe(1);
    expect(getDashboardFit(470).mealCardScale).toBe(1);
  });

  it('still scales the gauge cluster to fit compact screens', () => {
    expect(getDashboardFit(470).gaugeScale).toBeCloseTo(0.62);
    expect(getDashboardFit(784).gaugeScale).toBe(1);
  });
});
