import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMealFingerprint } from '@/lib/meal-fingerprint';

/**
 * Επιβεβαιώνει ότι το `createManualMeal` γράφει το ίδιο fingerprint που θα
 * υπολόγιζε το `computeMealFingerprint`, και ότι περνά το `source` override.
 */

const create = vi.fn();
const findFirst = vi.fn().mockResolvedValue(null);

vi.mock('@/server/db/prisma', () => ({
  prisma: {
    meal: { findFirst, create, findUnique: vi.fn() },
  },
}));

vi.mock('@/server/storage', () => ({
  getStorage: () => ({
    put: vi.fn(), get: vi.fn(), delete: vi.fn(), exists: vi.fn(),
  }),
  buildMealImageKey: (userId: string, _mime: string, variant: string) =>
    `meals/${userId}/${variant}.webp`,
}));
vi.mock('@/server/images', () => ({ processMealImage: vi.fn() }));
vi.mock('@/server/ai', () => ({ analyzeMealImage: vi.fn(), refineMealAnalysis: vi.fn() }));
vi.mock('@/server/auth/rate-limit', () => ({
  assertAiRateLimit: vi.fn(),
  assertUploadRateLimit: vi.fn(),
}));

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: 'm1' });
  findFirst.mockReset();
  findFirst.mockResolvedValue(null); // getMealForUser read-back -> NOT_FOUND (swallowed)
});

describe('createManualMeal fingerprint wiring', () => {
  it('stores fingerprint and honours source override', async () => {
    const { createManualMeal } = await import('@/server/services/meal');
    const input = {
      mealType: 'LUNCH',
      mealDateTime: '2026-08-06T12:00',
      title: 'Κοτόπουλο',
      items: [{ name: 'Κοτόπουλο', finalCalories: 350 }],
      acknowledgeHighCalories: false,
    } as never;

    // getMealForUser read-back returns null -> throws NOT_FOUND, which we ignore:
    // we only care about what was written to prisma.meal.create.
    await createManualMeal({
      userId: 'u1', input, timezone: 'Europe/Athens', source: 'SAVED_MEAL',
    }).catch(() => {});

    const data = create.mock.calls[0][0].data;
    expect(data.source).toBe('SAVED_MEAL');
    expect(data.mealFingerprint).toBe(
      computeMealFingerprint({
        title: 'Κοτόπουλο',
        mealType: 'LUNCH',
        totalCalories: 350,
        items: [{ name: 'Κοτόπουλο', calories: 350 }],
      }),
    );
  });

  it('defaults source to MANUAL when not provided', async () => {
    const { createManualMeal } = await import('@/server/services/meal');
    const input = {
      mealType: 'BREAKFAST',
      mealDateTime: '2026-08-06T09:00',
      finalCalories: 300,
      acknowledgeHighCalories: false,
    } as never;

    await createManualMeal({ userId: 'u1', input, timezone: 'Europe/Athens' }).catch(() => {});

    const data = create.mock.calls[0][0].data;
    expect(data.source).toBe('MANUAL');
    expect(typeof data.mealFingerprint).toBe('string');
    expect(data.mealFingerprint).toHaveLength(64);
  });
});
