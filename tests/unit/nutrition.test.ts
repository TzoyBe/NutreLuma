import { describe, expect, it } from 'vitest';
import {
  buildMacroProgress,
  caloriesFromMacros,
  suggestMacroTargets,
} from '@/lib/nutrition';

describe('suggestMacroTargets', () => {
  it('η κατανομή αντιστοιχεί περίπου στις θερμίδες στόχου', () => {
    const targets = suggestMacroTargets(2000, 'MAINTAIN');
    const derived = caloriesFromMacros(targets);
    // Στρογγυλοποίηση στα 5 g εισάγει μικρή απόκλιση — όχι πάνω από 3%.
    expect(Math.abs(derived - 2000) / 2000).toBeLessThan(0.03);
  });

  it('σε απώλεια βάρους προτείνει περισσότερη πρωτεΐνη', () => {
    const lose = suggestMacroTargets(2000, 'LOSE');
    const maintain = suggestMacroTargets(2000, 'MAINTAIN');
    expect(lose.proteinGrams).toBeGreaterThan(maintain.proteinGrams);
  });

  it('οι ίνες κλιμακώνονται με τις θερμίδες αλλά έχουν ανώτατο όριο', () => {
    expect(suggestMacroTargets(1500, 'MAINTAIN').fiberGrams).toBe(21);
    expect(suggestMacroTargets(6000, 'MAINTAIN').fiberGrams).toBe(50);
  });

  it('δεν παράγει αρνητικές τιμές για μηδενικό στόχο', () => {
    const targets = suggestMacroTargets(0, 'MAINTAIN');
    expect(targets.proteinGrams).toBe(0);
    expect(targets.fiberGrams).toBe(0);
  });
});

describe('caloriesFromMacros', () => {
  it('χρησιμοποιεί 4/4/9 kcal ανά γραμμάριο', () => {
    expect(caloriesFromMacros({ proteinGrams: 10, carbohydrateGrams: 10, fatGrams: 10 })).toBe(170);
  });

  it('τα άγνωστα macros μετρούν ως μηδέν', () => {
    expect(caloriesFromMacros({ proteinGrams: 10, carbohydrateGrams: null })).toBe(40);
  });
});

describe('buildMacroProgress', () => {
  it('χωρίς στόχο δεν παράγει ποσοστό', () => {
    const progress = buildMacroProgress(50, null);
    expect(progress.target).toBeNull();
    expect(progress.remaining).toBeNull();
    expect(progress.progressPercent).toBe(0);
    expect(progress.overTarget).toBe(false);
  });

  it('υπολογίζει υπόλοιπο και ποσοστό', () => {
    const progress = buildMacroProgress(60, 150);
    expect(progress.remaining).toBe(90);
    expect(progress.progressPercent).toBe(40);
    expect(progress.overTarget).toBe(false);
  });

  it('η μπάρα δεν ξεπερνά το 100% αλλά η υπέρβαση καταγράφεται', () => {
    const progress = buildMacroProgress(200, 150);
    expect(progress.progressPercent).toBe(100);
    expect(progress.overTarget).toBe(true);
    expect(progress.remaining).toBe(-50);
  });

  it('αρνητική κατανάλωση μηδενίζεται', () => {
    expect(buildMacroProgress(-10, 100).consumed).toBe(0);
  });
});
