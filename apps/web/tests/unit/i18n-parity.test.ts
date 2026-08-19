import { describe, expect, it } from 'vitest';
import { el } from '@/i18n/el';
import { en } from '@/i18n/en';

/** Όλα τα leaf paths (π.χ. "billing.title") ενός λεξικού. */
function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? leafPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('i18n dictionary parity (EL ↔ EN)', () => {
  const elKeys = new Set(leafPaths(el as unknown as Record<string, unknown>));
  const enKeys = new Set(leafPaths(en as unknown as Record<string, unknown>));

  it('no keys present in EL but missing in EN', () => {
    const missing = [...elKeys].filter((k) => !enKeys.has(k));
    expect(missing, `Missing in EN: ${missing.join(', ')}`).toEqual([]);
  });

  it('no keys present in EN but missing in EL', () => {
    const missing = [...enKeys].filter((k) => !elKeys.has(k));
    expect(missing, `Missing in EL: ${missing.join(', ')}`).toEqual([]);
  });
});
