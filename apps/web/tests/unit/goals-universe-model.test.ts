import { describe, expect, it } from 'vitest';
import { buildGoalUniverseModel } from '@/components/goals/goals-universe-model';

describe('buildGoalUniverseModel', () => {
  it('derives progress counts and keeps nullable macro targets explicit', () => {
    expect(buildGoalUniverseModel({
      calorieTarget: 2100,
      proteinGrams: 132,
      carbohydrateGrams: null,
      fatGrams: 70,
      achievementsUnlocked: 4,
      achievementsTotal: 12,
      badgesUnlocked: 3,
      activeMilestones: 2,
      historyCount: 6,
    })).toEqual({
      calories: 2100,
      macros: [
        { key: 'protein', label: 'Protein', value: 132, unit: 'g', tone: 'cyan' },
        { key: 'carbohydrate', label: 'Carbs', value: null, unit: 'g', tone: 'gold' },
        { key: 'fat', label: 'Fat', value: 70, unit: 'g', tone: 'violet' },
      ],
      journey: { achievements: '4/12', badges: '3', activeMilestones: '2', history: '6' },
    });
  });
});
