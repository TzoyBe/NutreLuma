import { describe, expect, it } from 'vitest';
import { allocateMealTargets, recipeVariation, normalizeRecipePayload } from '@/server/services/recipe-plans';

type Meal = { title: string; ingredients: Array<{ name: string; quantity: number; unit: string; estimatedCalories: number }>; steps: string[]; substitutions: unknown[]; mealType: string; difficulty: string };
const firstMeal = (raw: unknown): Meal => (normalizeRecipePayload(raw) as { meals: Meal[] }).meals[0]!;

describe('normalizeRecipePayload (tolerates model deviations)', () => {
  it('coerces string ingredients into objects', () => {
    const meal = firstMeal({ meals: [{ title: 'Oats', mealType: 'BREAKFAST', ingredients: ['50 g rolled oats', 'banana'] }] });
    expect(meal.ingredients[0]).toMatchObject({ name: 'rolled oats', quantity: 50, unit: 'g' });
    expect(meal.ingredients[1]).toMatchObject({ name: 'banana', quantity: 1 });
  });

  it('drops substitutions returned as plain strings', () => {
    const meal = firstMeal({ meals: [{ title: 'X', mealType: 'LUNCH', substitutions: ['use almond milk', 'swap rice for quinoa'] }] });
    expect(meal.substitutions).toEqual([]);
  });

  it('keeps well-formed substitutions', () => {
    const meal = firstMeal({ meals: [{ title: 'X', mealType: 'LUNCH', substitutions: [{ original: 'milk', replacement: 'almond milk', reason: 'dairy-free' }] }] });
    expect(meal.substitutions).toHaveLength(1);
  });

  it('flattens object steps into strings', () => {
    const meal = firstMeal({ meals: [{ title: 'X', mealType: 'DINNER', steps: [{ step: 'Chop' }, 'Cook'] }] });
    expect(meal.steps).toEqual(['Chop', 'Cook']);
  });

  it('defaults a missing title and normalizes mealType casing', () => {
    const meal = firstMeal({ meals: [{ mealType: 'breakfast' }] });
    expect(meal.title.length).toBeGreaterThan(0);
    expect(meal.mealType).toBe('BREAKFAST');
  });
});

describe('recipe meal allocation', () => {
  it('splits remaining calories and macros across remaining meals', () => {
    const result = allocateMealTargets({ calories: 2000, proteinGrams: 150, carbohydrateGrams: 210, fatGrams: 70, fiberGrams: 30 }, { calories: 1150, proteinGrams: 115, carbohydrateGrams: 155, fatGrams: 50, fiberGrams: 22 }, ['LUNCH', 'DINNER']);
    expect(result.map((meal) => meal.calories)).toEqual([613, 537]);
    expect(result.reduce((sum, meal) => sum + meal.calories, 0)).toBe(1150);
    expect(result.every((meal) => meal.calories >= 0 && meal.proteinGrams >= 0)).toBe(true);
  });
});

describe('recipeVariation', () => {
  it('no token on the initial (non-force) generation → stable fingerprint', () => {
    const v = recipeVariation(false, [], () => 'RND');
    expect(v.token).toBe('');
  });

  it('forced regeneration gets a fresh token so the fingerprint changes (avoids P2002)', () => {
    const v = recipeVariation(true, [], () => 'RND');
    expect(v.token).toBe('RND');
    expect(v.promptSuffix).toContain('RND');
  });

  it('two forced regenerations produce different tokens', () => {
    let n = 0;
    const rng = () => `tok${(n += 1)}`;
    expect(recipeVariation(true, [], rng).token).not.toBe(recipeVariation(true, [], rng).token);
  });

  it('adds recently suggested titles to the avoid list (deduped, capped)', () => {
    const titles = Array.from({ length: 20 }, (_, i) => `Dish ${i}`).concat('Dish 0');
    const v = recipeVariation(true, titles, () => 'RND');
    expect(v.avoid.length).toBeLessThanOrEqual(15);
    expect(new Set(v.avoid).size).toBe(v.avoid.length); // deduped
    expect(v.promptSuffix.toLowerCase()).toContain('avoid');
    expect(v.promptSuffix).toContain('Dish 0');
  });

  it('no avoid text when there are no recent titles', () => {
    expect(recipeVariation(false, [], () => 'RND').promptSuffix).toBe('');
  });
});
