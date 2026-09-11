import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GoalsPanel } from '@/components/goals/goals-panel';
import { LocaleProvider } from '@/i18n/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/components/toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}));

describe('GoalsPanel', () => {
  const goal = {
    calorieTarget: 2_000,
    proteinGrams: 120,
    carbohydrateGrams: 240,
    fatGrams: 70,
    fiberGrams: 30,
    waterMl: 2_500,
    stepsTarget: 8_000,
  };

  it('starts with the goals editor collapsed', () => {
    const html = renderToStaticMarkup(
      React.createElement(GoalsPanel, {
        goal,
        suggestion: null,
        history: [],
      }),
    );

    expect(html).toContain('Edit goals');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="daily-goals-editor"');
    expect(html).not.toContain('id="calorieTarget"');
  });

  it('shows no more than six goal-history rows', () => {
    const history = Array.from({ length: 7 }, (_, index) => ({
      id: `goal-${index + 1}`,
      effectiveFrom: `2026-09-${String(index + 1).padStart(2, '0')}`,
      source: 'MANUAL' as const,
      calorieTarget: 2_000 + index,
      proteinGrams: 120,
      carbohydrateGrams: 240,
      fatGrams: 70,
    }));

    const html = renderToStaticMarkup(
      React.createElement(GoalsPanel, { goal, suggestion: null, history }),
    );

    expect(html).toContain('2026-09-06');
    expect(html).not.toContain('2026-09-07');
  });

  it('uses Greek for the goals edit action when Greek is selected', () => {
    const html = renderToStaticMarkup(React.createElement(LocaleProvider, {
      locale: 'el',
      children: React.createElement(GoalsPanel, { goal, suggestion: null, history: [] }),
    }));
    expect(html).toContain('Επεξεργασία στόχων');
    expect(html).not.toContain('Edit goals');
  });
});
