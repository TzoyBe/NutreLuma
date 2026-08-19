import { beforeEach, describe, expect, it, vi } from 'vitest';

const dec = (n: number) => ({ toString: () => String(n) });

const maintenanceProfile = {
  upsert: vi.fn(async () => ({ id: 'mp1' })),
  findUnique: vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null),
};
const maintenanceRangeHistory = { create: vi.fn(async () => ({ id: 'rh1' })) };
const maintenanceAlert = {
  findUnique: vi.fn(async () => null),
  create: vi.fn(async () => ({ id: 'a1' })),
  findMany: vi.fn(async () => []),
  updateMany: vi.fn(async () => ({ count: 1 })),
};
const weightEntry = { findMany: vi.fn(async () => []) };
const meal = { findMany: vi.fn(async () => []) };
const waterEntry = { findMany: vi.fn(async () => []) };
const activityEntry = { findMany: vi.fn(async () => []) };
const healthProfile = { findUnique: vi.fn(async () => null) };

const txDelegates = { maintenanceProfile, maintenanceRangeHistory };
const fakePrisma = {
  maintenanceProfile,
  maintenanceRangeHistory,
  maintenanceAlert,
  weightEntry,
  meal,
  waterEntry,
  activityEntry,
  healthProfile,
  $transaction: vi.fn(async (fn: (t: typeof txDelegates) => Promise<unknown>) => fn(txDelegates)),
};

const setGoal = vi.fn(async () => ({}));
const setGoalMode = vi.fn(async () => ({ mode: 'MAINTENANCE', activatedAt: null }));
const getActiveGoalMode = vi.fn(async () => ({ mode: 'LOSS', activatedAt: null }));
const evaluateGoalsForUserBestEffort = vi.fn(() => undefined);

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/server/services/profile', () => ({ getUserTimezone: vi.fn(async () => 'UTC') }));
vi.mock('@/server/services/goals', () => ({
  setGoal,
  getGoalForDay: vi.fn(async () => ({ calorieTarget: 2000, proteinGrams: 100, waterMl: 2000 })),
}));
vi.mock('@/server/services/goal-mode', () => ({ setGoalMode, getActiveGoalMode }));
vi.mock('@/server/services/goals-evaluator', () => ({ evaluateGoalsForUserBestEffort }));

const service = await import('@/server/services/maintenance');

const baseInput = {
  targetWeightKg: 120,
  lowerBoundaryKg: 118.5,
  upperBoundaryKg: 121.5,
  weighInsPerWeek: 3,
  calorieTarget: 2600,
  applyCalorieTarget: false,
  proteinGrams: null,
  carbohydrateGrams: null,
  fatGrams: null,
  weeklyCalorieMin: null,
  weeklyCalorieMax: null,
  alertSensitivity: 'MEDIUM' as const,
  confirm: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  maintenanceProfile.findUnique.mockResolvedValue(null);
  getActiveGoalMode.mockResolvedValue({ mode: 'LOSS', activatedAt: null });
});

describe('activateMaintenance', () => {
  it('does NOT change the daily calorie goal when applyCalorieTarget is false', async () => {
    await service.activateMaintenance('u1', baseInput);
    expect(maintenanceProfile.upsert).toHaveBeenCalledTimes(1);
    expect(maintenanceRangeHistory.create).toHaveBeenCalledTimes(1);
    expect(setGoalMode).toHaveBeenCalledWith('u1', 'MAINTENANCE', expect.any(Object));
    expect(setGoal).not.toHaveBeenCalled();
  });

  it('updates the daily calorie goal only when the user opts in', async () => {
    await service.activateMaintenance('u1', { ...baseInput, applyCalorieTarget: true });
    expect(setGoal).toHaveBeenCalledTimes(1);
  });
});

describe('evaluateMaintenanceForUser', () => {
  it('is a no-op when the active mode is not MAINTENANCE', async () => {
    getActiveGoalMode.mockResolvedValueOnce({ mode: 'LOSS', activatedAt: null });
    await service.evaluateMaintenanceForUser('u1');
    expect(maintenanceProfile.findUnique).not.toHaveBeenCalled();
    expect(maintenanceAlert.create).not.toHaveBeenCalled();
  });

  it('scopes queries to the given user (cross-user isolation)', async () => {
    getActiveGoalMode.mockResolvedValueOnce({ mode: 'MAINTENANCE', activatedAt: null });
    maintenanceProfile.findUnique.mockResolvedValueOnce({
      userId: 'u1',
      targetWeightKg: dec(120),
      lowerBoundaryKg: dec(118.5),
      upperBoundaryKg: dec(121.5),
      toleranceKg: dec(1.5),
      weighInsPerWeek: 3,
      calorieTarget: 2600,
      proteinGrams: null,
      carbohydrateGrams: null,
      fatGrams: null,
      weeklyCalorieMin: null,
      weeklyCalorieMax: null,
      alertSensitivity: 'MEDIUM',
      activatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    await service.evaluateMaintenanceForUser('u1');
    expect(weightEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    );
  });
});
