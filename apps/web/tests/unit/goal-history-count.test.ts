import { describe, expect, it, vi } from 'vitest';

const rows = [
  ...Array.from({ length: 73 }, () => ({ userId: 'u1' })),
  ...Array.from({ length: 9 }, () => ({ userId: 'u2' })),
];

const nutritionGoal = {
  count: vi.fn(async ({ where }: { where: { userId: string } }) =>
    rows.filter((row) => row.userId === where.userId).length,
  ),
};

vi.mock('@/server/db/prisma', () => ({ prisma: { nutritionGoal } }));

const service = await import('@/server/services/goals');

describe('countGoalHistory', () => {
  it('counts every history entry for the requested user without a list cap', async () => {
    await expect(service.countGoalHistory('u1')).resolves.toBe(73);
  });
});
