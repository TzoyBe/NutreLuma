import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GoalsUniverse } from '@/components/goals/goals-universe';
import { buildGoalUniverseModel } from '@/components/goals/goals-universe-model';

describe('GoalsUniverse', () => {
  it('renders the labels supplied for the active locale', () => {
    const html = renderToStaticMarkup(
      createElement(GoalsUniverse, {
        model: buildGoalUniverseModel({
          calorieTarget: 2100,
          proteinGrams: 132,
          carbohydrateGrams: 240,
          fatGrams: 70,
          achievementsUnlocked: 4,
          achievementsTotal: 12,
          badgesUnlocked: 3,
          activeMilestones: 2,
          historyCount: 6,
        }),
        labels: {
          title: 'Ημερήσιοι διατροφικοί στόχοι',
          protein: 'Πρωτεΐνη',
          carbohydrate: 'Υδατάνθρακες',
          fat: 'Λιπαρά',
        },
      }),
    );

    expect(html).toContain('Ημερήσιοι διατροφικοί στόχοι');
    expect(html).toContain('Πρωτεΐνη');
    expect(html).toContain('Υδατάνθρακες');
    expect(html).toContain('Λιπαρά');
  });
});
