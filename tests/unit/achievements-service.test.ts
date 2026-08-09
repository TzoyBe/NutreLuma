import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENTS } from '@/lib/achievements-catalog';

const dec = (n: number | null) => (n === null ? null : { toString: () => String(n) });
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const store = {
  achievements: [] as Array<{ userId: string; achievementCode: string; unlockedAt: Date }>,
  definitions: [] as Array<Record<string, unknown>>,
};

const meal = {
  findMany: vi.fn(async () => [
    {
      mealDateTime: new Date('2026-08-01T10:00:00.000Z'),
      finalCalories: 500,
      proteinGrams: dec(35),
      source: 'MANUAL',
    },
    {
      mealDateTime: new Date('2026-08-01T14:00:00.000Z'),
      finalCalories: 700,
      proteinGrams: dec(45),
      source: 'SAVED_MEAL',
    },
    {
      mealDateTime: new Date('2026-08-02T10:00:00.000Z'),
      finalCalories: 500,
      proteinGrams: dec(30),
      source: 'MANUAL',
    },
  ]),
};

const weightEntry = {
  findMany: vi.fn(async () => [
    { weightKg: dec(82) },
    { weightKg: dec(80.5) },
  ]),
};

const healthProfile = {
  findUnique: vi.fn(async () => ({ currentWeightKg: dec(80.5), targetWeightKg: dec(78) })),
};

const favoriteMeal = { count: vi.fn(async () => 1) };
const waterEntry = {
  findMany: vi.fn(async () => [
    { entryDate: day('2026-08-01'), volumeMl: 1000 },
    { entryDate: day('2026-08-01'), volumeMl: 1200 },
  ]),
};
const activityEntry = {
  count: vi.fn(async () => 2),
  findMany: vi.fn(async () => [{ entryDate: day('2026-08-01') }, { entryDate: day('2026-08-01') }]),
};
const milestone = {
  findMany: vi.fn(async () => [
    {
      status: 'COMPLETED',
      completedAt: new Date('2026-08-05T00:00:00.000Z'),
      endDate: day('2026-08-06'),
    },
  ]),
};
const achievementDefinition = {
  upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
    store.definitions.push(create);
    return create;
  }),
};
const userAchievement = {
  findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
    store.achievements.filter((row) => row.userId === where.userId),
  ),
  create: vi.fn(async ({ data }: { data: { userId: string; achievementCode: string } }) => {
    const row = { ...data, unlockedAt: new Date('2026-08-08T10:00:00.000Z') };
    store.achievements.push(row);
    return row;
  }),
};

const maintenanceProfile = { findUnique: vi.fn(async () => null) };

const fakePrisma = {
  meal,
  weightEntry,
  healthProfile,
  favoriteMeal,
  waterEntry,
  activityEntry,
  milestone,
  maintenanceProfile,
  achievementDefinition,
  userAchievement,
  $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
};

const createNotification = vi.fn(async () => ({ id: 'n1' }));
const awardBadge = vi.fn(async () => ({ awarded: true }));

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/server/services/profile', () => ({ getUserTimezone: vi.fn(async () => 'UTC') }));
vi.mock('@/server/services/goals', () => ({
  getGoalForDay: vi.fn(async () => ({ calorieTarget: 2000, proteinGrams: 100, waterMl: 2000 })),
}));
vi.mock('@/server/services/notifications', () => ({ createNotification }));
vi.mock('@/server/services/badges', () => ({ awardBadge }));

const service = await import('@/server/services/achievements');

beforeEach(() => {
  vi.clearAllMocks();
  store.achievements = [];
  store.definitions = [];
});

describe('achievements service', () => {
  it('computes user metrics from real data delegates', async () => {
    const metrics = await service.computeUserAchievementMetrics('u1');

    expect(metrics.mealsLogged).toBe(3);
    expect(metrics.loggingStreakDays).toBe(2);
    expect(metrics.weightEntries).toBe(2);
    expect(metrics.weightLostKg).toBe(1.5);
    expect(metrics.savedFavorites).toBe(1);
    expect(metrics.waterTargetDays).toBe(1);
    expect(metrics.milestonesCompleted).toBe(1);
    expect(metrics.milestoneBeforeDeadline).toBe(1);
  });

  it('upserts catalog and unlocks achievements idempotently with badge awards', async () => {
    const first = await service.evaluateAchievementsForUser('u1');
    const unlockedAfterFirst = store.achievements.length;
    const second = await service.evaluateAchievementsForUser('u1');

    expect(achievementDefinition.upsert).toHaveBeenCalledTimes(ACHIEVEMENTS.length * 2);
    expect(unlockedAfterFirst).toBeGreaterThan(0);
    expect(store.achievements).toHaveLength(unlockedAfterFirst);
    expect(createNotification).toHaveBeenCalledTimes(unlockedAfterFirst);
    expect(awardBadge).toHaveBeenCalledTimes(unlockedAfterFirst);
    expect(first.filter((a) => a.unlocked)).toHaveLength(unlockedAfterFirst);
    expect(second.filter((a) => a.unlocked)).toHaveLength(unlockedAfterFirst);
  });
});
