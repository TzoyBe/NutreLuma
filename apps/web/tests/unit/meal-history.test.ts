import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Service-level έλεγχος του meal-history με mocked Prisma.
 * Καλύπτει: user isolation, recent ordering, frequent ranking, IDOR στο
 * resolveComposition, scaling στο preview, no-AI + source στο createQuickPick,
 * και idempotency στο addFavorite.
 */

const dec = (n: number | null) => (n === null ? null : { toNumber: () => n });

/** Ελάχιστη αλλά έγκυρη γραμμή σε σχήμα MEAL_SELECT (ό,τι διαβάζει το toMealView). */
function mealRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meal-1',
    mealType: 'LUNCH',
    title: 'Κοτόπουλο με ρύζι',
    notes: null,
    mealDateTime: new Date('2026-08-06T10:00:00Z'),
    createdAt: new Date('2026-08-06T10:00:00Z'),
    updatedAt: new Date('2026-08-06T10:00:00Z'),
    status: 'CONFIRMED',
    source: 'MANUAL',
    confirmedAt: new Date('2026-08-06T10:00:00Z'),
    analysisStatus: 'COMPLETED',
    aiEstimatedCalories: null,
    finalCalories: 600,
    aiMinCalories: null,
    aiMaxCalories: null,
    aiConfidence: null,
    aiModel: null,
    aiProvider: null,
    aiAnalyzedAt: null,
    aiErrorCode: null,
    wasManuallyEdited: true,
    imagePath: null,
    thumbPath: null,
    proteinGrams: dec(30),
    carbohydrateGrams: dec(45),
    fatGrams: dec(10),
    fiberGrams: dec(3),
    sugarGrams: dec(5),
    saturatedFatGrams: dec(2),
    sodiumMg: 400,
    items: [
      {
        id: 'it-1', name: 'Κοτόπουλο', estimatedQuantity: '150 g',
        aiEstimatedCalories: null, finalCalories: 350, aiMinCalories: null, aiMaxCalories: null,
        proteinGrams: dec(30), carbohydrateGrams: dec(0), fatGrams: dec(10),
        fiberGrams: dec(0), sugarGrams: dec(0), saturatedFatGrams: dec(2), sodiumMg: 200,
      },
    ],
    clarifications: [],
    ...overrides,
  };
}

function favRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fav-1', userId: 'u1', fingerprint: 'f'.repeat(64), title: 'Αγαπημένο',
    mealType: 'LUNCH', calories: 600,
    proteinGrams: dec(30), carbohydrateGrams: dec(45), fatGrams: dec(10),
    fiberGrams: dec(3), sugarGrams: dec(5), saturatedFatGrams: dec(2), sodiumMg: 400,
    items: [{ name: 'Κοτόπουλο', estimatedQuantity: '150 g', finalCalories: 350, macros: {} }],
    thumbKey: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

const meal = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
};
const favoriteMeal = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};
const $queryRaw = vi.fn();

vi.mock('@/server/db/prisma', () => ({ prisma: { meal, favoriteMeal, $queryRaw } }));
vi.mock('@/server/storage', () => ({
  getStorage: () => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn(), exists: vi.fn() }),
  buildMealImageKey: (u: string, _m: string, v: string) => `meals/${u}/${v}.webp`,
}));
vi.mock('@/server/images', () => ({ processMealImage: vi.fn() }));
const analyzeMock = vi.fn();
vi.mock('@/server/ai', () => ({ analyzeMealImage: analyzeMock, refineMealAnalysis: vi.fn() }));
vi.mock('@/server/auth/rate-limit', () => ({
  assertAiRateLimit: vi.fn(), assertUploadRateLimit: vi.fn(),
}));

const svc = await import('@/server/services/meal-history');
const { ApiError } = await import('@/server/errors');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRecentMeals', () => {
  it('φιλτράρει CONFIRMED του χρήστη, ταξινομεί φθίνουσα και σέβεται το limit', async () => {
    meal.findMany.mockResolvedValue([mealRow()]);
    const res = await svc.getRecentMeals('u1', 5);
    const arg = meal.findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ userId: 'u1', status: 'CONFIRMED' });
    expect(arg.orderBy).toEqual({ mealDateTime: 'desc' });
    expect(arg.take).toBe(5);
    expect(res).toHaveLength(1);
    expect(res[0].finalCalories).toBe(600);
  });
});

describe('getFrequentMeals', () => {
  it('ταξινομεί με βάση το frequencyScore (συχνό+πρόσφατο πάνω από σπάνιο+παλιό)', async () => {
    const now = new Date('2026-08-06T12:00:00Z');
    $queryRaw.mockResolvedValue([
      { fingerprint: 'aaa', usageCount: 1, lastUsedAt: new Date('2026-06-01T12:00:00Z'), representativeId: 'meal-old', groupMealType: 'DINNER' },
      { fingerprint: 'bbb', usageCount: 12, lastUsedAt: now, representativeId: 'meal-hot', groupMealType: 'LUNCH' },
    ]);
    meal.findMany.mockResolvedValue([
      mealRow({ id: 'meal-hot', title: 'Hot' }),
      mealRow({ id: 'meal-old', title: 'Old' }),
    ]);
    favoriteMeal.findMany.mockResolvedValue([{ fingerprint: 'bbb' }]);

    const res = await svc.getFrequentMeals('u1', { now, hour: 13 });
    expect(res.map((r) => r.fingerprint)).toEqual(['bbb', 'aaa']);
    expect(res[0].isFavorite).toBe(true);
    expect(res[1].isFavorite).toBe(false);
    expect(res[0].usageCount).toBe(12);
  });

  it('επιστρέφει κενό όταν δεν υπάρχουν fingerprints', async () => {
    $queryRaw.mockResolvedValue([]);
    expect(await svc.getFrequentMeals('u1', { now: new Date(), hour: 8 })).toEqual([]);
  });
});

describe('resolveComposition (anti-IDOR)', () => {
  it("'recent' ref για γεύμα άλλου χρήστη -> NOT_FOUND", async () => {
    meal.findFirst.mockResolvedValue(null); // userId-scoped where δεν βρίσκει τίποτα
    await expect(svc.resolveComposition('u1', { kind: 'recent', mealId: 'other' }))
      .rejects.toBeInstanceOf(ApiError);
    const where = meal.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'other', userId: 'u1', status: 'CONFIRMED' });
  });

  it("'favorite' ref άλλου χρήστη -> NOT_FOUND", async () => {
    favoriteMeal.findFirst.mockResolvedValue(null);
    await expect(svc.resolveComposition('u1', { kind: 'favorite', id: 'x' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('previewQuickPick', () => {
  it('εφαρμόζει τον multiplier μέσω scaleComposition (μισές θερμίδες στο 0.5)', async () => {
    favoriteMeal.findFirst.mockResolvedValue(favRow());
    const res = await svc.previewQuickPick('u1', { kind: 'favorite', id: 'fav-1' }, 0.5);
    expect(res.composition.finalCalories).toBe(300);
    expect(res.composition.macros.proteinGrams).toBe(15);
    expect(res.multiplier).toBe(0.5);
  });
});

describe('createQuickPick', () => {
  it("καλεί createManualMeal με source SAVED_MEAL και ΔΕΝ αγγίζει το AI", async () => {
    favoriteMeal.findFirst.mockResolvedValue(favRow());
    // createManualMeal: requestKey-check findFirst -> null, μετά read-back findFirst -> row
    meal.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.requestKey !== undefined ? null : mealRow(),
    );
    meal.create.mockResolvedValue({ id: 'meal-new' });

    const res = await svc.createQuickPick(
      'u1',
      { ref: { kind: 'favorite', id: 'fav-1' }, servingMultiplier: 1, mealType: 'DINNER' },
      'Europe/Athens',
    );

    expect(analyzeMock).not.toHaveBeenCalled();
    const data = meal.create.mock.calls[0][0].data;
    expect(data.source).toBe('SAVED_MEAL');
    expect(res.meal).toBeDefined();
  });
});

describe('addFavorite', () => {
  it('είναι idempotent στο [userId, fingerprint]', async () => {
    favoriteMeal.findFirst.mockResolvedValue(favRow()); // base για resolveComposition
    favoriteMeal.findUnique.mockResolvedValueOnce(null);   // 1η φορά: δεν υπάρχει
    favoriteMeal.create.mockResolvedValue(favRow());

    await svc.addFavorite('u1', { kind: 'favorite', id: 'fav-1' });
    expect(favoriteMeal.create).toHaveBeenCalledTimes(1);

    // 2η φορά: υπάρχει ήδη -> δεν ξαναδημιουργεί
    favoriteMeal.findUnique.mockResolvedValueOnce(favRow());
    await svc.addFavorite('u1', { kind: 'favorite', id: 'fav-1' });
    expect(favoriteMeal.create).toHaveBeenCalledTimes(1);
  });
});
