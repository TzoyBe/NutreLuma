import { describe, expect, it } from 'vitest';
import { buildRecipeUniverseModel } from '@/components/recipes/recipes-universe-model';

describe('buildRecipeUniverseModel', () => {
  it('derives remaining macros and journey counts when a plan exists', () => {
    expect(buildRecipeUniverseModel({
      hasPlan: true,
      remainingCalories: 812.4,
      remainingProteinGrams: 54.6,
      remainingCarbohydrateGrams: 90.2,
      remainingFatGrams: 22.9,
      mealsPlanned: 3,
      savedCount: 5,
    })).toEqual({
      calories: 812,
      macros: [
        { key: 'protein', label: 'Protein', value: 55, unit: 'g', tone: 'cyan' },
        { key: 'carbohydrate', label: 'Carbs', value: 90, unit: 'g', tone: 'gold' },
        { key: 'fat', label: 'Fat', value: 23, unit: 'g', tone: 'violet' },
      ],
      journey: { mealsPlanned: '3', saved: '5' },
    });
  });

  it('keeps macros explicit when no plan has been generated yet', () => {
    const model = buildRecipeUniverseModel({
      hasPlan: false,
      remainingCalories: 0,
      remainingProteinGrams: 0,
      remainingCarbohydrateGrams: 0,
      remainingFatGrams: 0,
      mealsPlanned: 0,
      savedCount: 2,
    });
    expect(model.calories).toBeNull();
    expect(model.macros.every((macro) => macro.value === null)).toBe(true);
    expect(model.journey).toEqual({ mealsPlanned: '0', saved: '2' });
  });
});
