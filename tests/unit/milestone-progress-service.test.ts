import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Milestone } from '@prisma/client';

const dec = (n: number | null) => (n === null ? null : { toString: () => String(n) });
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function milestone(overrides: Partial<Milestone> = {}): Milestone {
  return {
    id: 'm1',
    userId: 'u1',
    title: 'Milestone',
    description: null,
    type: 'MEAL_LOGGING_DAYS',
    unit: 'days',
    startValue: dec(0) as never,
    targetValue: dec(3) as never,
    currentValue: dec(0) as never,
    dailyThreshold: null,
    startDate: day('2026-08-01'),
    endDate: day('2026-08-07'),
    status: 'ACTIVE',
    completedAt: null,
    progressMethod: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

const store = {
  weights: [] as Array<{ userId: string; entryDate: Date; weightKg: unknown }>,
  meals: [] as Array<{
    userId: string;
    mealDateTime: Date;
    finalCalories: number | null;
    proteinGrams: unknown;
    status: string;
  }>,
  milestones: [] as Milestone[],
  progress: [] as Array<Record<string, unknown>>,
};

const weightEntry = {
  findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.weights
      .filter((row) => row.userId === where.userId)
      .filter((row) => {
        const range = where.entryDate as { gte?: Date; lte?: Date } | undefined;
        return (!range?.gte || row.entryDate >= range.gte) && (!range?.lte || row.entryDate <= range.lte);
      })
      .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime()),
  ),
  findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.weights
      .filter((row) => row.userId === where.userId)
      .filter((row) => {
        const range = where.entryDate as { lte?: Date } | undefined;
        return !range?.lte || row.entryDate <= range.lte;
      })
      .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())[0] ?? null,
  ),
};

const meal = {
  findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.meals
      .filter((row) => row.userId === where.userId)
      .filter((row) => row.status === where.status)
      .filter((row) => row.finalCalories !== null)
      .filter((row) => {
        const range = where.mealDateTime as { gte?: Date; lt?: Date } | undefined;
        return (!range?.gte || row.mealDateTime >= range.gte) && (!range?.lt || row.mealDateTime < range.lt);
      }),
  ),
};

const milestoneDelegate = {
  findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.milestones.find((row) => row.id === where.id && row.userId === where.userId) ?? null,
  ),
  findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.milestones.filter((row) => row.userId === where.userId && row.status === 'ACTIVE'),
  ),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const found = store.milestones.find((row) => row.id === where.id);
    if (found) Object.assign(found, data);
    return found;
  }),
};

const milestoneProgress = {
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    store.progress.push(data);
    return data;
  }),
};

const fakePrisma = {
  weightEntry,
  meal,
  milestone: milestoneDelegate,
  milestoneProgress,
  $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
};

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/server/services/profile', () => ({ getUserTimezone: vi.fn(async () => 'UTC') }));
vi.mock('@/server/services/goals', () => ({
  getGoalForDay: vi.fn(async () => ({ calorieTarget: 2000, proteinGrams: 100, waterMl: 2000 })),
}));
vi.mock('@/server/services/water', () => ({
  waterMlByDay: vi.fn(async () => new Map([['2026-08-02', 2200]])),
}));
vi.mock('@/server/services/activity', () => ({
  stepsByDay: vi.fn(async () => new Map([['2026-08-02', 10000]])),
  activeDays: vi.fn(async () => ['2026-08-02', '2026-08-03']),
}));
vi.mock('@/server/services/notifications', () => ({
  createNotification: vi.fn(async () => ({ id: 'n1' })),
}));

const service = await import('@/server/services/milestone-progress');

beforeEach(() => {
  vi.clearAllMocks();
  store.weights = [];
  store.meals = [];
  store.milestones = [];
  store.progress = [];
});

describe('computeMilestoneProgress', () => {
  it('computes target-weight progress and completes from moving average', async () => {
    store.weights.push(
      { userId: 'u1', entryDate: day('2026-08-01'), weightKg: dec(82) },
      { userId: 'u1', entryDate: day('2026-08-03'), weightKg: dec(80) },
      { userId: 'u1', entryDate: day('2026-08-05'), weightKg: dec(79) },
      { userId: 'u1', entryDate: day('2026-08-07'), weightKg: dec(78.5) },
    );

    const result = await service.computeMilestoneProgress(
      'u1',
      milestone({
        type: 'TARGET_WEIGHT',
        startValue: dec(82) as never,
        targetValue: dec(80) as never,
      }),
      new Date('2026-08-07T12:00:00.000Z'),
    );

    expect(result.completed).toBe(true);
    expect(result.method).toBe('moving_avg_7d');
    expect(result.currentValue).toBeLessThanOrEqual(80);
  });

  it('counts distinct meal logging days in the user timezone window', async () => {
    store.meals.push(
      {
        userId: 'u1',
        mealDateTime: new Date('2026-08-02T10:00:00.000Z'),
        finalCalories: 500,
        proteinGrams: dec(20),
        status: 'CONFIRMED',
      },
      {
        userId: 'u1',
        mealDateTime: new Date('2026-08-02T18:00:00.000Z'),
        finalCalories: 700,
        proteinGrams: dec(30),
        status: 'CONFIRMED',
      },
      {
        userId: 'u1',
        mealDateTime: new Date('2026-08-03T10:00:00.000Z'),
        finalCalories: 400,
        proteinGrams: dec(10),
        status: 'CONFIRMED',
      },
    );

    const result = await service.computeMilestoneProgress(
      'u1',
      milestone({ targetValue: dec(2) as never }),
      new Date('2026-08-04T12:00:00.000Z'),
    );

    expect(result.currentValue).toBe(2);
    expect(result.completed).toBe(true);
  });

  it('marks active milestones as missed after endDate when not complete', async () => {
    const result = await service.computeMilestoneProgress(
      'u1',
      milestone({ targetValue: dec(5) as never, endDate: day('2026-08-02') }),
      new Date('2026-08-04T12:00:00.000Z'),
    );

    expect(result.missed).toBe(true);
    expect(result.completed).toBe(false);
  });

  it('rejects cross-user direct compute attempts', async () => {
    await expect(
      service.computeMilestoneProgress('u1', milestone({ userId: 'u2' })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('persisted milestone progress', () => {
  it('records custom progress and completes when it reaches target', async () => {
    store.milestones.push(
      milestone({ id: 'm1', type: 'CUSTOM_NUMERIC', targetValue: dec(10) as never }),
    );

    const result = await service.recordCustomMilestoneProgress('u1', 'm1', 10);

    expect(result.completed).toBe(true);
    expect(milestoneDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(milestoneProgress.create).toHaveBeenCalledTimes(1);
  });
});
