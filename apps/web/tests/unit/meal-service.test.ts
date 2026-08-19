import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Έλεγχος της λογικής γευμάτων με in-memory fake του Prisma.
 * Στόχος: απομόνωση δεδομένων ανά χρήστη (anti-IDOR), δημιουργία, διόρθωση
 * και διαγραφή γεύματος, χωρίς εξάρτηση από πραγματική βάση.
 */

/** Τα macros είναι Decimal στη βάση· εδώ αρκούν αριθμοί ή null. */
interface FakeMacros {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}

const NO_MACROS: FakeMacros = {
  proteinGrams: null,
  carbohydrateGrams: null,
  fatGrams: null,
  fiberGrams: null,
  sugarGrams: null,
  saturatedFatGrams: null,
  sodiumMg: null,
};

interface FakeItem extends FakeMacros {
  id: string;
  mealId: string;
  name: string;
  estimatedQuantity: string | null;
  aiEstimatedCalories: number | null;
  finalCalories: number | null;
  aiMinCalories: number | null;
  aiMaxCalories: number | null;
  sortOrder: number;
}

interface FakeClarification {
  id: string;
  mealId: string;
  questionId: string;
  question: string;
  options: string[];
  answer: string | null;
  answeredAt: Date | null;
  sortOrder: number;
}

interface FakeMeal extends FakeMacros {
  id: string;
  userId: string;
  mealType: string;
  title: string | null;
  notes: string | null;
  mealDateTime: Date;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  source: string;
  confirmedAt: Date | null;
  analysisStatus: string;
  aiEstimatedCalories: number | null;
  finalCalories: number | null;
  aiMinCalories: number | null;
  aiMaxCalories: number | null;
  aiConfidence: number | null;
  aiModel: string | null;
  aiAnalyzedAt: Date | null;
  aiErrorCode: string | null;
  wasManuallyEdited: boolean;
  imagePath: string | null;
  thumbPath: string | null;
  requestKey: string | null;
  aiRawResponse: unknown;
}

const store = {
  meals: [] as FakeMeal[],
  items: [] as FakeItem[],
  clarifications: [] as FakeClarification[],
  aiLogs: [] as Array<Record<string, unknown>>,
};

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

function baseMeal(overrides: Partial<FakeMeal>): FakeMeal {
  return {
    id: nextId('meal'),
    userId: 'user-1',
    mealType: 'LUNCH',
    title: 'Γεύμα',
    notes: null,
    mealDateTime: new Date('2026-08-04T10:30:00.000Z'),
    createdAt: new Date('2026-08-04T10:31:00.000Z'),
    updatedAt: new Date('2026-08-04T10:31:00.000Z'),
    status: 'CONFIRMED',
    source: 'AI_IMAGE',
    confirmedAt: new Date('2026-08-04T10:31:00.000Z'),
    analysisStatus: 'COMPLETED',
    aiEstimatedCalories: 720,
    finalCalories: 720,
    aiMinCalories: null,
    aiMaxCalories: null,
    aiConfidence: 0.78,
    aiModel: 'mock-vision-1',
    aiAnalyzedAt: new Date('2026-08-04T10:31:00.000Z'),
    aiErrorCode: null,
    wasManuallyEdited: false,
    imagePath: 'meals/user-1/2026/08/a-full.webp',
    thumbPath: 'meals/user-1/2026/08/a-thumb.webp',
    requestKey: null,
    aiRawResponse: null,
    ...NO_MACROS,
    ...overrides,
  };
}

/** Υποστηρίζει τις μορφές φίλτρου που χρησιμοποιεί όντως το service. */
function statusMatches(actual: string, filter: unknown): boolean {
  if (typeof filter === 'string') return actual === filter;
  if (filter && typeof filter === 'object') {
    const f = filter as { in?: string[]; not?: string };
    if (f.in) return f.in.includes(actual);
    if (f.not) return actual !== f.not;
  }
  return true;
}

function matches(meal: FakeMeal, where: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === 'id' && meal.id !== value) return false;
    if (key === 'userId' && meal.userId !== value) return false;
    if (key === 'requestKey' && meal.requestKey !== value) return false;
    if (key === 'status' && !statusMatches(meal.status, value)) return false;
  }
  return true;
}

/**
 * Το Prisma επιστρέφει `Decimal` για τις στήλες macros, όχι σκέτο number.
 * Ο fake πρέπει να το μιμείται, αλλιώς τα tests θα περνούσαν με λάθος τύπο.
 * Το `sodiumMg` είναι Int και μένει αριθμός.
 */
const DECIMAL_MACROS = [
  'proteinGrams',
  'carbohydrateGrams',
  'fatGrams',
  'fiberGrams',
  'sugarGrams',
  'saturatedFatGrams',
] as const;

/** Διαβάζει τα macro πεδία από ένα Prisma `data` object. */
function pickMacros(data: Record<string, unknown>): FakeMacros {
  const num = (key: string) => {
    const value = data[key];
    return typeof value === 'number' ? value : null;
  };
  return {
    proteinGrams: num('proteinGrams'),
    carbohydrateGrams: num('carbohydrateGrams'),
    fatGrams: num('fatGrams'),
    fiberGrams: num('fiberGrams'),
    sugarGrams: num('sugarGrams'),
    saturatedFatGrams: num('saturatedFatGrams'),
    sodiumMg: num('sodiumMg'),
  };
}

function withDecimals<T extends Record<string, unknown>>(row: T): T {
  const result: Record<string, unknown> = { ...row };
  for (const key of DECIMAL_MACROS) {
    const value = result[key];
    result[key] = typeof value === 'number' ? { toNumber: () => value } : null;
  }
  return result as T;
}

function withItems(meal: FakeMeal) {
  return {
    ...withDecimals(meal as unknown as Record<string, unknown>),
    items: store.items
      .filter((item) => item.mealId === meal.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => withDecimals(item as unknown as Record<string, unknown>)),
    clarifications: store.clarifications
      .filter((c) => c.mealId === meal.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

const mealDelegate = {
  findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const found = store.meals.find((meal) => matches(meal, where));
    return found ? withItems(found) : null;
  }),
  findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
    const found = store.meals.find((meal) => meal.id === where.id);
    return found ? withItems(found) : null;
  }),
  findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.meals.filter((meal) => matches(meal, where)).map(withItems),
  ),
  count: vi.fn(async () => 0),
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const meal = baseMeal({
      id: nextId('meal'),
      userId: String(data.userId),
      mealType: String(data.mealType ?? 'OTHER'),
      title: (data.title as string | null) ?? null,
      notes: (data.notes as string | null) ?? null,
      mealDateTime: data.mealDateTime as Date,
      status: String(data.status ?? 'PENDING'),
      source: String(data.source ?? 'AI_IMAGE'),
      confirmedAt: (data.confirmedAt as Date | null) ?? null,
      analysisStatus: String(data.analysisStatus ?? 'PENDING'),
      aiEstimatedCalories: null,
      finalCalories: (data.finalCalories as number | null) ?? null,
      aiConfidence: null,
      aiModel: null,
      aiAnalyzedAt: null,
      wasManuallyEdited: Boolean(data.wasManuallyEdited),
      imagePath: (data.imagePath as string | null) ?? null,
      thumbPath: (data.thumbPath as string | null) ?? null,
      requestKey: (data.requestKey as string | null) ?? null,
      proteinGrams: (data.proteinGrams as number | null) ?? null,
      carbohydrateGrams: (data.carbohydrateGrams as number | null) ?? null,
      fatGrams: (data.fatGrams as number | null) ?? null,
      fiberGrams: (data.fiberGrams as number | null) ?? null,
      sugarGrams: (data.sugarGrams as number | null) ?? null,
      saturatedFatGrams: (data.saturatedFatGrams as number | null) ?? null,
      sodiumMg: (data.sodiumMg as number | null) ?? null,
    });
    store.meals.push(meal);

    const nested = data.items as { create?: Array<Record<string, unknown>> } | undefined;
    for (const [index, item] of (nested?.create ?? []).entries()) {
      store.items.push({
        ...NO_MACROS,
        id: nextId('item'),
        mealId: meal.id,
        name: String(item.name),
        estimatedQuantity: (item.estimatedQuantity as string | null) ?? null,
        aiEstimatedCalories: (item.aiEstimatedCalories as number | null) ?? null,
        finalCalories: (item.finalCalories as number | null) ?? null,
        aiMinCalories: (item.aiMinCalories as number | null) ?? null,
        aiMaxCalories: (item.aiMaxCalories as number | null) ?? null,
        sortOrder: (item.sortOrder as number | undefined) ?? index,
      });
    }
    return withItems(meal);
  }),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const meal = store.meals.find((m) => m.id === where.id);
    if (!meal) throw new Error('not found');
    const { items, ...rest } = data as Record<string, unknown> & {
      items?: { create?: Array<Record<string, unknown>> };
    };
    Object.assign(meal, rest);
    if (items?.create) {
      for (const [index, item] of items.create.entries()) {
        store.items.push({
          id: nextId('item'),
          mealId: meal.id,
          name: String(item.name),
          estimatedQuantity: (item.estimatedQuantity as string | null) ?? null,
          aiEstimatedCalories: (item.aiEstimatedCalories as number | null) ?? null,
          finalCalories: (item.finalCalories as number | null) ?? null,
          aiMinCalories: (item.aiMinCalories as number | null) ?? null,
          aiMaxCalories: (item.aiMaxCalories as number | null) ?? null,
          sortOrder: (item.sortOrder as number | undefined) ?? index,
          ...pickMacros(item),
        });
      }
    }
    return withItems(meal);
  }),
  delete: vi.fn(async ({ where }: { where: { id: string } }) => {
    const index = store.meals.findIndex((meal) => meal.id === where.id);
    if (index === -1) throw new Error('not found');
    const [removed] = store.meals.splice(index, 1);
    store.items = store.items.filter((item) => item.mealId !== removed!.id);
    return removed!;
  }),
};

const mealItemDelegate = {
  deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const before = store.items.length;
    const notIn = (where.id as { notIn?: string[] } | undefined)?.notIn;
    store.items = store.items.filter((item) => {
      if (item.mealId !== where.mealId) return true;
      if (notIn) return notIn.includes(item.id);
      return false;
    });
    return { count: before - store.items.length };
  }),
  updateMany: vi.fn(
    async ({ where, data }: { where: { id: string; mealId: string }; data: Record<string, unknown> }) => {
      const item = store.items.find((i) => i.id === where.id && i.mealId === where.mealId);
      if (!item) return { count: 0 };
      Object.assign(item, data);
      return { count: 1 };
    },
  ),
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const item: FakeItem = {
      ...NO_MACROS,
      id: nextId('item'),
      mealId: String(data.mealId),
      name: String(data.name),
      estimatedQuantity: (data.estimatedQuantity as string | null) ?? null,
      aiEstimatedCalories: (data.aiEstimatedCalories as number | null) ?? null,
      finalCalories: (data.finalCalories as number | null) ?? null,
      aiMinCalories: (data.aiMinCalories as number | null) ?? null,
      aiMaxCalories: (data.aiMaxCalories as number | null) ?? null,
      sortOrder: (data.sortOrder as number | undefined) ?? 0,
    };
    store.items.push(item);
    return item;
  }),
};

const clarificationDelegate = {
  deleteMany: vi.fn(async ({ where }: { where: { mealId: string } }) => {
    const before = store.clarifications.length;
    store.clarifications = store.clarifications.filter((c) => c.mealId !== where.mealId);
    return { count: before - store.clarifications.length };
  }),
  createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
    for (const [index, row] of data.entries()) {
      store.clarifications.push({
        id: nextId('clar'),
        mealId: String(row.mealId),
        questionId: String(row.questionId),
        question: String(row.question),
        options: row.options as string[],
        answer: null,
        answeredAt: null,
        sortOrder: (row.sortOrder as number | undefined) ?? index,
      });
    }
    return { count: data.length };
  }),
  updateMany: vi.fn(
    async ({
      where,
      data,
    }: {
      where: { mealId: string; questionId: string };
      data: Record<string, unknown>;
    }) => {
      const row = store.clarifications.find(
        (c) => c.mealId === where.mealId && c.questionId === where.questionId,
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  ),
};

const fakePrisma = {
  meal: mealDelegate,
  mealItem: mealItemDelegate,
  mealClarification: clarificationDelegate,
  aiUsageLog: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      store.aiLogs.push(data);
      return data;
    }),
    count: vi.fn(async () => 0),
  },
  $transaction: vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(fakePrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));

vi.mock('@/server/storage', () => ({
  getStorage: () => ({
    name: 'fake',
    put: vi.fn(async (key: string) => ({ key, size: 10, contentType: 'image/webp' })),
    get: vi.fn(async () => Buffer.from('fake-image')),
    delete: vi.fn(async () => undefined),
    exists: vi.fn(async () => true),
  }),
  buildMealImageKey: (userId: string, _mime: string, variant: string) =>
    `meals/${userId}/2026/08/${variant}.webp`,
}));

vi.mock('@/server/images', () => ({
  processMealImage: vi.fn(async () => ({
    full: Buffer.from('full'),
    thumb: Buffer.from('thumb'),
    contentType: 'image/webp' as const,
    originalMime: 'image/jpeg',
    width: 800,
    height: 600,
  })),
}));

const NO_ITEM_MACROS = {
  proteinGrams: null,
  carbohydrateGrams: null,
  fatGrams: null,
  fiberGrams: null,
  sugarGrams: null,
  saturatedFatGrams: null,
  sodiumMg: null,
};

function analysisFixture(overrides: Record<string, unknown> = {}) {
  return {
    totalCalories: 640,
    minCalories: 580,
    maxCalories: 700,
    confidence: 0.8,
    macros: {
      proteinGrams: 45,
      carbohydrateGrams: 60,
      fatGrams: 18,
      fiberGrams: 5,
      sugarGrams: 4,
      saturatedFatGrams: 3,
      sodiumMg: 700,
    },
    items: [
      {
        name: 'rice',
        estimatedQuantity: '200 g',
        estimatedCalories: 260,
        minCalories: 240,
        maxCalories: 280,
        macros: { ...NO_ITEM_MACROS, proteinGrams: 5, carbohydrateGrams: 56, fatGrams: 1 },
      },
      {
        name: 'chicken',
        estimatedQuantity: '180 g',
        estimatedCalories: 380,
        minCalories: 340,
        maxCalories: 420,
        macros: { ...NO_ITEM_MACROS, proteinGrams: 40, carbohydrateGrams: 4, fatGrams: 17 },
      },
    ],
    clarifications: [
      {
        id: 'oil_amount',
        question: 'Πόσο λάδι χρησιμοποιήθηκε;',
        options: ['Χωρίς λάδι', '1 κουταλιά', 'Δεν γνωρίζω'],
      },
    ],
    internalReasoningSummary: 'summary',
    ...overrides,
  };
}

const analyzeMock = vi.fn(async () => ({
  status: 'SUCCESS' as const,
  analysis: analysisFixture(),
  model: 'mock-vision-1',
  provider: 'mock',
  requestId: 'req_1',
  durationMs: 120,
}));

const refineMock = vi.fn(async () => ({
  status: 'SUCCESS' as const,
  // Το refinement στενεύει το εύρος και ανεβάζει τη βεβαιότητα.
  analysis: analysisFixture({
    totalCalories: 700,
    minCalories: 680,
    maxCalories: 720,
    confidence: 0.9,
    clarifications: [],
  }),
  model: 'mock-vision-1',
  provider: 'mock',
  requestId: 'req_2',
  durationMs: 130,
}));

vi.mock('@/server/ai', () => ({
  analyzeMealImage: (...args: unknown[]) => analyzeMock(...(args as [])),
  refineMealAnalysis: (...args: unknown[]) => refineMock(...(args as [])),
}));

vi.mock('@/server/auth/rate-limit', () => ({
  assertAiRateLimit: vi.fn(async () => undefined),
  assertUploadRateLimit: vi.fn(async () => undefined),
}));

const {
  answerClarifications,
  cancelMeal,
  confirmMeal,
  createManualMeal,
  createMealWithAnalysis,
  deleteMeal,
  getMealForUser,
  listMealsForDay,
  listPendingDrafts,
  updateMeal,
} = await import('@/server/services/meal');
const { ApiError } = await import('@/server/errors');

beforeEach(() => {
  store.meals = [];
  store.items = [];
  store.clarifications = [];
  store.aiLogs = [];
  analyzeMock.mockClear();
  refineMock.mockClear();
});

describe('απομόνωση δεδομένων χρήστη', () => {
  beforeEach(() => {
    store.meals.push(baseMeal({ id: 'meal-a', userId: 'user-1' }));
    store.meals.push(baseMeal({ id: 'meal-b', userId: 'user-2' }));
  });

  it('ο χρήστης βλέπει το δικό του γεύμα', async () => {
    const meal = await getMealForUser('user-1', 'meal-a');
    expect(meal.id).toBe('meal-a');
  });

  it('δεν επιτρέπει πρόσβαση σε γεύμα άλλου χρήστη', async () => {
    await expect(getMealForUser('user-1', 'meal-b')).rejects.toBeInstanceOf(ApiError);
    await expect(getMealForUser('user-1', 'meal-b')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('δεν επιτρέπει επεξεργασία γεύματος άλλου χρήστη', async () => {
    await expect(
      updateMeal('user-1', 'meal-b', { finalCalories: 100, acknowledgeHighCalories: false }, 'UTC'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // Το γεύμα του άλλου χρήστη μένει ανέπαφο.
    expect(store.meals.find((m) => m.id === 'meal-b')!.finalCalories).toBe(720);
  });

  it('δεν επιτρέπει διαγραφή γεύματος άλλου χρήστη', async () => {
    await expect(deleteMeal('user-1', 'meal-b')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(store.meals.some((m) => m.id === 'meal-b')).toBe(true);
  });
});

describe('δημιουργία γεύματος με ανάλυση', () => {
  it('αποθηκεύει την AI εκτίμηση και τα τρόφιμα', async () => {
    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });

    expect(meal.analysisStatus).toBe('COMPLETED');
    expect(meal.aiEstimatedCalories).toBe(640);
    expect(meal.finalCalories).toBe(640);
    expect(meal.items).toHaveLength(2);
    expect(meal.wasManuallyEdited).toBe(false);
    expect(store.aiLogs).toHaveLength(1);
  });

  it('αφήνει το γεύμα σε επιθεώρηση, ΟΧΙ καταχωρισμένο', async () => {
    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });

    expect(meal.status).toBe('REVIEW_REQUIRED');
    expect(meal.countsTowardTotals).toBe(false);
    expect(meal.confirmedAt).toBeNull();
    expect(meal.source).toBe('AI_IMAGE');
  });

  it('αποθηκεύει εύρος θερμίδων και macros', async () => {
    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });

    expect(meal.aiMinCalories).toBe(580);
    expect(meal.aiMaxCalories).toBe(700);
    expect(meal.macros.proteinGrams).toBe(45);
    expect(meal.macros.sodiumMg).toBe(700);
    expect(meal.items[0]!.macros.carbohydrateGrams).toBe(56);
  });

  it('αποθηκεύει τις διευκρινιστικές ερωτήσεις', async () => {
    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });

    expect(meal.clarifications).toHaveLength(1);
    expect(meal.clarifications[0]!.questionId).toBe('oil_amount');
    expect(meal.pendingClarifications).toBe(1);
  });

  it('σε αποτυχία ανάλυσης δεν καταχωρίζει θερμίδες', async () => {
    analyzeMock.mockResolvedValueOnce({
      status: 'INVALID_RESPONSE',
      reason: 'SCHEMA_MISMATCH',
      model: 'mock-vision-1',
      provider: 'mock',
      requestId: null,
      durationMs: 90,
    } as never);

    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'DINNER', mealDateTime: '2026-08-04T20:00' },
      timezone: 'Europe/Athens',
    });

    expect(meal.analysisStatus).toBe('FAILED');
    expect(meal.finalCalories).toBeNull();
    expect(meal.aiEstimatedCalories).toBeNull();
    expect(meal.aiErrorCode).toBe('INVALID_RESPONSE');
  });

  it('δεν δημιουργεί διπλή εγγραφή για το ίδιο requestKey', async () => {
    const input = {
      mealType: 'LUNCH' as const,
      mealDateTime: '2026-08-04T13:30',
      requestKey: 'idem-key-123456',
    };
    const first = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input,
      timezone: 'Europe/Athens',
    });
    const second = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input,
      timezone: 'Europe/Athens',
    });

    expect(second.duplicated).toBe(true);
    expect(second.meal.id).toBe(first.meal.id);
    expect(store.meals).toHaveLength(1);
  });

  it('μετατρέπει την τοπική ώρα σε UTC', async () => {
    await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });
    expect(store.meals[0]!.mealDateTime.toISOString()).toBe('2026-08-04T10:30:00.000Z');
  });
});

describe('χειροκίνητη διόρθωση γεύματος', () => {
  beforeEach(() => {
    store.meals.push(baseMeal({ id: 'meal-a', userId: 'user-1' }));
    store.items.push({
      ...NO_MACROS,
      id: 'item-1',
      mealId: 'meal-a',
      name: 'rice',
      estimatedQuantity: '200 g',
      aiEstimatedCalories: 260,
      finalCalories: 260,
      aiMinCalories: null,
      aiMaxCalories: null,
      sortOrder: 0,
    });
  });

  it('κρατά την αρχική AI εκτίμηση και σημειώνει την επεξεργασία', async () => {
    const meal = await updateMeal(
      'user-1',
      'meal-a',
      { finalCalories: 500, acknowledgeHighCalories: false },
      'Europe/Athens',
    );
    expect(meal.finalCalories).toBe(500);
    expect(meal.aiEstimatedCalories).toBe(720);
    expect(meal.wasManuallyEdited).toBe(true);
  });

  it('απαιτεί ρητή επιβεβαίωση για ασυνήθιστα υψηλές θερμίδες', async () => {
    await expect(
      updateMeal('user-1', 'meal-a', { finalCalories: 5000, acknowledgeHighCalories: false }, 'UTC'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('αποθηκεύει υψηλή τιμή όταν ο χρήστης επιβεβαιώνει', async () => {
    const meal = await updateMeal(
      'user-1',
      'meal-a',
      { finalCalories: 5000, acknowledgeHighCalories: true },
      'UTC',
    );
    expect(meal.finalCalories).toBe(5000);
  });

  it('υπολογίζει το σύνολο από τα τρόφιμα όταν δεν δίνεται ρητά', async () => {
    const meal = await updateMeal(
      'user-1',
      'meal-a',
      {
        items: [
          { id: 'item-1', name: 'rice', estimatedQuantity: '150 g', finalCalories: 200 },
          { name: 'salad', estimatedQuantity: '1 bowl', finalCalories: 120 },
        ],
        acknowledgeHighCalories: false,
      },
      'UTC',
    );
    expect(meal.finalCalories).toBe(320);
    expect(meal.items).toHaveLength(2);
  });
});

describe('διαγραφή γεύματος', () => {
  it('διαγράφει το γεύμα του χρήστη', async () => {
    store.meals.push(baseMeal({ id: 'meal-a', userId: 'user-1' }));
    await deleteMeal('user-1', 'meal-a');
    expect(store.meals).toHaveLength(0);
  });

  it('επιστρέφει NOT_FOUND για ανύπαρκτο γεύμα', async () => {
    await expect(deleteMeal('user-1', 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('ροή επιβεβαίωσης (draft flow)', () => {
  async function createDraft() {
    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });
    return meal;
  }

  it('τα drafts ΔΕΝ εμφανίζονται στα γεύματα της ημέρας', async () => {
    await createDraft();
    const meals = await listMealsForDay('user-1', '2026-08-04', 'Europe/Athens');
    expect(meals).toHaveLength(0);
  });

  it('τα drafts εμφανίζονται στη λίστα εκκρεμοτήτων', async () => {
    const draft = await createDraft();
    const drafts = await listPendingDrafts('user-1');
    expect(drafts.map((m) => m.id)).toContain(draft.id);
  });

  it('μετά την επιβεβαίωση το γεύμα μετρά κανονικά', async () => {
    const draft = await createDraft();
    const confirmed = await confirmMeal('user-1', draft.id);

    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.countsTowardTotals).toBe(true);
    expect(confirmed.confirmedAt).not.toBeNull();

    const meals = await listMealsForDay('user-1', '2026-08-04', 'Europe/Athens');
    expect(meals.map((m) => m.id)).toContain(draft.id);
  });

  it('η ακύρωση βγάζει το γεύμα από παντού χωρίς να το διαγράφει', async () => {
    const draft = await createDraft();
    const cancelled = await cancelMeal('user-1', draft.id);

    expect(cancelled.status).toBe('CANCELLED');
    expect(await listMealsForDay('user-1', '2026-08-04', 'Europe/Athens')).toHaveLength(0);
    expect(await listPendingDrafts('user-1')).toHaveLength(0);
    // Η εγγραφή παραμένει για audit.
    expect(store.meals.some((m) => m.id === draft.id)).toBe(true);
  });

  it('δεν επιτρέπει ακύρωση ήδη καταχωρισμένου γεύματος', async () => {
    const draft = await createDraft();
    await confirmMeal('user-1', draft.id);
    await expect(cancelMeal('user-1', draft.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('δεν επιτρέπει επιβεβαίωση γεύματος άλλου χρήστη', async () => {
    const draft = await createDraft();
    await expect(confirmMeal('user-2', draft.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('διευκρινιστικές ερωτήσεις', () => {
  async function createDraft() {
    const { meal } = await createMealWithAnalysis({
      userId: 'user-1',
      file: Buffer.from('image'),
      input: { mealType: 'LUNCH', mealDateTime: '2026-08-04T13:30' },
      timezone: 'Europe/Athens',
    });
    return meal;
  }

  it('η απάντηση ενημερώνει την εκτίμηση μέσω refinement', async () => {
    const draft = await createDraft();
    const updated = await answerClarifications('user-1', draft.id, {
      answers: [{ questionId: 'oil_amount', answer: '1 κουταλιά' }],
    });

    expect(refineMock).toHaveBeenCalledTimes(1);
    expect(updated.finalCalories).toBe(700);
    expect(updated.aiConfidence).toBe(0.9);
    // Το γεύμα παραμένει draft — η επιβεβαίωση είναι ξεχωριστό βήμα.
    expect(updated.status).toBe('REVIEW_REQUIRED');
  });

  it('«Δεν γνωρίζω» δεν ξοδεύει κλήση στο AI', async () => {
    const draft = await createDraft();
    const updated = await answerClarifications('user-1', draft.id, {
      answers: [{ questionId: 'oil_amount', answer: 'Δεν γνωρίζω' }],
    });

    expect(refineMock).not.toHaveBeenCalled();
    expect(updated.finalCalories).toBe(640);
    expect(updated.clarifications[0]!.answer).toBe('Δεν γνωρίζω');
  });

  it('απορρίπτει απάντηση εκτός των δοθέντων επιλογών', async () => {
    const draft = await createDraft();
    await expect(
      answerClarifications('user-1', draft.id, {
        answers: [{ questionId: 'oil_amount', answer: 'ό,τι θέλω εγώ' }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(refineMock).not.toHaveBeenCalled();
  });

  it('απορρίπτει άγνωστη ερώτηση', async () => {
    const draft = await createDraft();
    await expect(
      answerClarifications('user-1', draft.id, {
        answers: [{ questionId: 'δεν_υπάρχει', answer: 'κάτι' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('χειροκίνητη καταχώριση', () => {
  it('καταχωρίζεται απευθείας χωρίς AI και μετρά αμέσως', async () => {
    const { meal } = await createManualMeal({
      userId: 'user-1',
      input: {
        mealType: 'BREAKFAST',
        mealDateTime: '2026-08-04T09:00',
        finalCalories: 350,
        proteinGrams: 20,
        acknowledgeHighCalories: false,
      },
      timezone: 'Europe/Athens',
    });

    expect(analyzeMock).not.toHaveBeenCalled();
    expect(meal.status).toBe('CONFIRMED');
    expect(meal.source).toBe('MANUAL');
    expect(meal.countsTowardTotals).toBe(true);
    expect(meal.finalCalories).toBe(350);
    expect(meal.macros.proteinGrams).toBe(20);
  });

  it('αθροίζει θερμίδες και macros από τα τρόφιμα όταν δεν δίνονται συνολικά', async () => {
    const { meal } = await createManualMeal({
      userId: 'user-1',
      input: {
        mealType: 'DINNER',
        mealDateTime: '2026-08-04T20:00',
        items: [
          { name: 'ψωμί', finalCalories: 160, proteinGrams: 6 },
          { name: 'τυρί', finalCalories: 200, proteinGrams: 14 },
        ],
        acknowledgeHighCalories: false,
      },
      timezone: 'Europe/Athens',
    });

    expect(meal.finalCalories).toBe(360);
    expect(meal.macros.proteinGrams).toBe(20);
  });

  it('απαιτεί ρητή επιβεβαίωση για ασυνήθιστα υψηλή τιμή', async () => {
    await expect(
      createManualMeal({
        userId: 'user-1',
        input: {
          mealType: 'OTHER',
          mealDateTime: '2026-08-04T20:00',
          finalCalories: 4500,
          acknowledgeHighCalories: false,
        },
        timezone: 'Europe/Athens',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
