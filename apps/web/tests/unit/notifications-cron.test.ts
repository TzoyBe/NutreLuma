import { beforeEach, describe, expect, it, vi } from 'vitest';

const healthProfile = {
  findMany: vi.fn(async () => [{ userId: 'u1' }, { userId: 'u2' }]),
  findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => {
    if (where.userId === 'u2') throw new Error('boom');
    return null;
  }),
};

vi.mock('@/server/db/prisma', () => ({ prisma: { healthProfile } }));

const service = await import('@/server/services/notifications');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runMealReminderNotificationsForAllUsers', () => {
  it('processes every user with a health profile, tolerating per-user failures', async () => {
    const result = await service.runMealReminderNotificationsForAllUsers();

    expect(result.userCount).toBe(2);
    expect(healthProfile.findUnique).toHaveBeenCalledTimes(2);
    expect(healthProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    expect(healthProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u2' } }),
    );
  });
});
