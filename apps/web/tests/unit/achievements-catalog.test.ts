import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, BADGES, badgeCodeFor } from '@/lib/achievements-catalog';

describe('achievements catalog', () => {
  it('has unique achievement codes', () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every achievement has positive threshold and required fields', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.code).toMatch(/^[A-Z0-9_]+$/);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.threshold).toBeGreaterThan(0);
      expect(['LOGGING', 'WEIGHT', 'NUTRITION', 'HYDRATION', 'ACTIVITY', 'MILESTONE', 'MAINTENANCE']).toContain(a.category);
      expect(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).toContain(a.tier);
    }
  });

  it('has one badge per achievement with unique codes', () => {
    expect(BADGES.length).toBe(ACHIEVEMENTS.length);
    const badgeCodes = BADGES.map((b) => b.code);
    expect(new Set(badgeCodes).size).toBe(badgeCodes.length);
    for (const a of ACHIEVEMENTS) {
      expect(badgeCodes).toContain(badgeCodeFor(a.code));
    }
  });

  it('covers all required achievement groups', () => {
    const cats = new Set(ACHIEVEMENTS.map((a) => a.category));
    for (const c of ['LOGGING', 'WEIGHT', 'NUTRITION', 'HYDRATION', 'ACTIVITY', 'MILESTONE']) {
      expect(cats.has(c as never)).toBe(true);
    }
  });
});
