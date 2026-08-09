import { beforeEach, describe, expect, it, vi } from 'vitest';

const userGoalMode = {
  findUnique: vi.fn(),
  upsert: vi.fn(async () => ({ activatedAt: new Date('2026-08-08T00:00:00.000Z') })),
};
const healthProfile = { findUnique: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) };
const goalModeHistory = {
  updateMany: vi.fn(async () => ({ count: 1 })),
  create: vi.fn(async () => ({ id: 'h1' })),
  findMany: vi.fn(async () => []),
};

const tx = { goalModeHistory, userGoalMode, healthProfile };
const fakePrisma = {
  userGoalMode,
  healthProfile,
  goalModeHistory,
  $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
};

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/server/services/profile', () => ({ getUserTimezone: vi.fn(async () => 'UTC') }));

const service = await import('@/server/services/goal-mode');

beforeEach(() => {
  vi.clearAllMocks();
  userGoalMode.upsert.mockResolvedValue({ activatedAt: new Date('2026-08-08T00:00:00.000Z') });
});

describe('getActiveGoalMode', () => {
  it('reads UserGoalMode when present', async () => {
    userGoalMode.findUnique.mockResolvedValueOnce({
      mode: 'MAINTENANCE',
      activatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect((await service.getActiveGoalMode('u1')).mode).toBe('MAINTENANCE');
  });

  it('derives from HealthProfile.goal when no row (MAINTAIN → MAINTENANCE)', async () => {
    userGoalMode.findUnique.mockResolvedValueOnce(null);
    healthProfile.findUnique.mockResolvedValueOnce({ goal: 'MAINTAIN' });
    const res = await service.getActiveGoalMode('u1');
    expect(res.mode).toBe('MAINTENANCE');
    expect(res.activatedAt).toBeNull();
  });

  it('defaults to LOSS when no profile', async () => {
    userGoalMode.findUnique.mockResolvedValueOnce(null);
    healthProfile.findUnique.mockResolvedValueOnce(null);
    expect((await service.getActiveGoalMode('u1')).mode).toBe('LOSS');
  });
});

describe('setGoalMode', () => {
  it('closes previous history, opens new, upserts mode, syncs profile goal', async () => {
    await service.setGoalMode('u1', 'MAINTENANCE', { reason: 'reached_target', targetWeightKg: 120 });

    expect(goalModeHistory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', endDate: null } }),
    );
    expect(goalModeHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mode: 'MAINTENANCE', reason: 'reached_target' }) }),
    );
    expect(userGoalMode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, update: { mode: 'MAINTENANCE' } }),
    );
    // GoalMode.MAINTENANCE → Goal.MAINTAIN synced on profile
    expect(healthProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { goal: 'MAINTAIN' } }),
    );
  });

  it('maps LOSS → LOSE for legacy profile goal', async () => {
    await service.setGoalMode('u1', 'LOSS', {});
    expect(healthProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { goal: 'LOSE' } }),
    );
  });
});
