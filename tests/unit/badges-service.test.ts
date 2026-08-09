import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BADGES } from '@/lib/achievements-catalog';

const store = {
  userBadges: [] as Array<{ userId: string; badgeCode: string; unlockedAt: Date }>,
  definitions: [] as Array<Record<string, unknown>>,
};

const badgeDefinition = {
  upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
    store.definitions.push(create);
    return create;
  }),
};

const userBadge = {
  findUnique: vi.fn(async ({ where }: { where: { userId_badgeCode: { userId: string; badgeCode: string } } }) =>
    store.userBadges.find(
      (row) =>
        row.userId === where.userId_badgeCode.userId &&
        row.badgeCode === where.userId_badgeCode.badgeCode,
    ) ?? null,
  ),
  create: vi.fn(async ({ data }: { data: { userId: string; badgeCode: string } }) => {
    const row = { ...data, unlockedAt: new Date('2026-08-08T10:00:00.000Z') };
    store.userBadges.push(row);
    return row;
  }),
  findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
    store.userBadges.filter((row) => row.userId === where.userId),
  ),
};

const fakePrisma = {
  badgeDefinition,
  userBadge,
  $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
};

const createNotification = vi.fn(async () => ({ id: 'n1' }));

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/server/services/notifications', () => ({ createNotification }));

const service = await import('@/server/services/badges');

beforeEach(() => {
  vi.clearAllMocks();
  store.userBadges = [];
  store.definitions = [];
});

describe('badges service', () => {
  it('upserts the badge catalog idempotently from source of truth', async () => {
    await service.upsertBadgeCatalog();

    expect(badgeDefinition.upsert).toHaveBeenCalledTimes(BADGES.length);
    expect(store.definitions[0]).toMatchObject({ code: BADGES[0]!.code, sortOrder: 0 });
  });

  it('awards a badge once and sends one notification', async () => {
    const badgeCode = BADGES[0]!.code;

    expect(await service.awardBadge('u1', badgeCode)).toEqual({ awarded: true });
    expect(await service.awardBadge('u1', badgeCode)).toEqual({ awarded: false });

    expect(userBadge.create).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('lists locked and unlocked catalog badges for the user only', async () => {
    store.userBadges.push({
      userId: 'u1',
      badgeCode: BADGES[0]!.code,
      unlockedAt: new Date('2026-08-08T10:00:00.000Z'),
    });
    store.userBadges.push({
      userId: 'u2',
      badgeCode: BADGES[1]!.code,
      unlockedAt: new Date('2026-08-08T10:00:00.000Z'),
    });

    const rows = await service.listBadges('u1');

    expect(rows[0]!.unlocked).toBe(true);
    expect(rows[1]!.unlocked).toBe(false);
  });
});
