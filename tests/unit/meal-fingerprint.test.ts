import { describe, expect, it } from 'vitest';
import { computeMealFingerprint, normalizeText } from '@/lib/meal-fingerprint';

const base = {
  title: 'Κοτόπουλο με ρύζι',
  mealType: 'LUNCH',
  totalCalories: 600,
  items: [
    { name: 'Κοτόπουλο', calories: 350 },
    { name: 'Ρύζι', calories: 250 },
  ],
};

describe('normalizeText', () => {
  it('lowercases, trims, collapses spaces, strips diacritics and punctuation', () => {
    expect(normalizeText('  Κοτόπουλο,   ΨΗΤΟ! ')).toBe('κοτοπουλο ψητο');
    expect(normalizeText('Crème Brûlée')).toBe('creme brulee');
  });
});

describe('computeMealFingerprint', () => {
  it('is deterministic', () => {
    expect(computeMealFingerprint(base)).toBe(computeMealFingerprint(base));
  });

  it('ignores item order', () => {
    const reordered = { ...base, items: [...base.items].reverse() };
    expect(computeMealFingerprint(reordered)).toBe(computeMealFingerprint(base));
  });

  it('ignores accents/case/whitespace in titles and item names', () => {
    const variant = {
      ...base,
      title: 'κοτοπουλο  με  ρυζι',
      items: [{ name: 'κοτοπουλο', calories: 350 }, { name: 'ρυζι', calories: 250 }],
    };
    expect(computeMealFingerprint(variant)).toBe(computeMealFingerprint(base));
  });

  it('groups near-equal item calories (within 25 kcal bucket)', () => {
    const close = {
      ...base,
      items: [{ name: 'Κοτόπουλο', calories: 360 }, { name: 'Ρύζι', calories: 240 }],
    };
    expect(computeMealFingerprint(close)).toBe(computeMealFingerprint(base));
  });

  it('does NOT group different compositions with the same total calories', () => {
    const different = {
      ...base,
      title: 'Σαλάτα',
      items: [{ name: 'Μαρούλι', calories: 100 }, { name: 'Τόνος', calories: 500 }],
    };
    expect(computeMealFingerprint(different)).not.toBe(computeMealFingerprint(base));
  });

  it('does NOT group different item calories beyond the bucket', () => {
    const heavier = {
      ...base,
      items: [{ name: 'Κοτόπουλο', calories: 500 }, { name: 'Ρύζι', calories: 250 }],
    };
    expect(computeMealFingerprint(heavier)).not.toBe(computeMealFingerprint(base));
  });

  it('falls back to item names when title is empty', () => {
    const noTitle = { ...base, title: null };
    expect(computeMealFingerprint(noTitle)).toHaveLength(64);
  });

  it('handles itemless meals via title + total calorie bucket', () => {
    const fp = computeMealFingerprint({ title: 'Πρωτεΐνη', mealType: 'OTHER', totalCalories: 120, items: [] });
    expect(fp).toHaveLength(64);
  });
});
