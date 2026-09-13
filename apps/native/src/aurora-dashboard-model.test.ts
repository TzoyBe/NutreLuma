import { describe, expect, it } from 'vitest';

import { buildAuroraDashboardModel, clampProgress } from './aurora-dashboard-model';

describe('clampProgress', () => {
  it.each([
    { current: 42, target: 100, expected: 0.42 },
    { current: 120, target: 100, expected: 1 },
    { current: -10, target: 100, expected: 0 },
    { current: 10, target: 0, expected: 0 },
    { current: Number.NaN, target: 100, expected: 0 },
  ])('returns $expected for $current / $target', ({ current, target, expected }) => {
    expect(clampProgress(current, target)).toBe(expected);
  });
});

describe('buildAuroraDashboardModel', () => {
  it('preserves over-target values while clamping the visual progress', () => {
    const model = buildAuroraDashboardModel({
      calories: { current: 2450, target: 2000 },
      protein: { current: 120, target: 100 },
      carbohydrate: { current: 130, target: 250 },
      fat: { current: 45, target: 70 },
      fiber: { current: 18, target: 30 },
      water: { current: 800, target: 2000 },
      steps: { current: 3400, target: 10000 },
    });

    expect(model.calories).toMatchObject({ current: 2450, target: 2000, progress: 1, percent: 123 });
    expect(model.metrics[0]).toMatchObject({ key: 'protein', current: 120, target: 100, progress: 1 });
    expect(model.summary).toContain('123%');
  });

  it('uses visible zero-state values when targets are missing', () => {
    const model = buildAuroraDashboardModel({
      calories: { current: 0, target: null },
      protein: { current: 0, target: null },
      carbohydrate: { current: 0, target: null },
      fat: { current: 0, target: null },
      fiber: { current: 0, target: null },
      water: { current: 0, target: null },
      steps: { current: 0, target: null },
    });

    expect(model.calories).toMatchObject({ progress: 0, percent: 0 });
    expect(model.metrics.every((metric) => metric.progress === 0)).toBe(true);
    expect(model.summary).toBe('Set your daily goals to light up your progress.');
  });
});
