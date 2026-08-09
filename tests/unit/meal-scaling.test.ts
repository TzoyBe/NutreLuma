import { describe, expect, it } from 'vitest';
import { scaleComposition } from '@/lib/meal-scaling';

const macros = {
  proteinGrams: 30, carbohydrateGrams: 45.5, fatGrams: 10, fiberGrams: 3,
  sugarGrams: 5, saturatedFatGrams: 2.25, sodiumMg: 400,
};
const base = { finalCalories: 600, macros, items: [
  { name: 'Κοτόπουλο', estimatedQuantity: '150 g', finalCalories: 350, macros },
] };

describe('scaleComposition', () => {
  it('scales calories and all macros proportionally at 0.5', () => {
    const r = scaleComposition(base, 0.5);
    expect(r.finalCalories).toBe(300);
    expect(r.macros.proteinGrams).toBe(15);
    expect(r.macros.carbohydrateGrams).toBe(22.75);
    expect(r.macros.saturatedFatGrams).toBe(1.13); // 2.25*0.5=1.125 -> 1.13 (2dp)
    expect(r.macros.sodiumMg).toBe(200);
  });

  it('is identity at multiplier 1', () => {
    const r = scaleComposition(base, 1);
    expect(r.finalCalories).toBe(600);
    expect(r.macros.carbohydrateGrams).toBe(45.5);
  });

  it('scales items too', () => {
    const r = scaleComposition(base, 2);
    expect(r.items[0].finalCalories).toBe(700);
    expect(r.items[0].macros.proteinGrams).toBe(60);
  });

  it('preserves null macros as null (unknown stays unknown)', () => {
    const r = scaleComposition(
      { finalCalories: null, macros: { ...macros, proteinGrams: null }, items: [] },
      2,
    );
    expect(r.finalCalories).toBe(null);
    expect(r.macros.proteinGrams).toBe(null);
    expect(r.macros.fatGrams).toBe(20);
  });

  it('is decimal-safe (no float drift)', () => {
    const r = scaleComposition({ finalCalories: 100, macros: { ...macros, proteinGrams: 0.1 }, items: [] }, 3);
    expect(r.macros.proteinGrams).toBe(0.3); // not 0.30000000000000004
  });

  it('rejects non-positive or absurd multipliers', () => {
    expect(() => scaleComposition(base, 0)).toThrow();
    expect(() => scaleComposition(base, 25)).toThrow();
  });
});
