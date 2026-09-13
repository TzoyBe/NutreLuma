import { describe, expect, it } from 'vitest';
import {
  buildOrbitalDashboardModel,
  safeProgress,
} from '@/components/dashboard/orbital-dashboard-model';

const input = {
  calories: { current: 1370, target: 3280 },
  protein: { current: 84, target: 205 },
  carbohydrate: { current: 160, target: 370 },
  fat: { current: 44, target: 110 },
  fiber: { current: 10, target: 46 },
  water: { current: 0, target: 2500 },
  steps: { current: 0, target: 10000 },
};

describe('orbital dashboard model', () => {
  it('clamps progress and handles missing targets', () => {
    expect(safeProgress(15, 10)).toBe(1);
    expect(safeProgress(-2, 10)).toBe(0);
    expect(safeProgress(2, null)).toBe(0);
  });

  it('builds time-aware and data-aware dashboard copy', () => {
    const model = buildOrbitalDashboardModel(input, 14);
    expect(model.greeting).toBe('Good afternoon');
    expect(model.calories.percent).toBe(42);
    expect(model.insights.map((item) => item.body).join(' ')).toContain('water');
  });

  it('keeps the displayed percent truthful above target', () => {
    const model = buildOrbitalDashboardModel(
      { ...input, calories: { current: 3500, target: 3000 } },
      22,
    );
    expect(model.greeting).toBe('Good evening');
    expect(model.calories.progress).toBe(1);
    expect(model.calories.percent).toBe(117);
    expect(model.focus.body).toContain('beyond');
  });
});
