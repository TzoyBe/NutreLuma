import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  userId: string;
  type: 'MILESTONE_COMPLETED' | 'ACHIEVEMENT_UNLOCKED';
  title: string;
  body: string;
  milestoneId: string | null;
  dedupeKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const store = { rows: [] as Row[] };
let next = 0;

function matches(row: Row, where: Record<string, unknown>): boolean {
  if (where.userId && row.userId !== where.userId) return false;
  if ('readAt' in where && row.readAt !== where.readAt) return false;
  const id = where.id as { in?: string[] } | undefined;
  if (id?.in && !id.in.includes(row.id)) return false;
  return true;
}

const notification = {
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row: Row = {
      id: `n${(next += 1)}`,
      userId: String(data.userId),
      type: data.type as Row['type'],
      title: String(data.title),
      body: String(data.body),
      milestoneId: (data.milestoneId as string | null) ?? null,
      dedupeKey: (data.dedupeKey as string | null) ?? null,
      readAt: null,
      createdAt: new Date(`2026-08-08T10:0${next}:00.000Z`),
    };
    store.rows.push(row);
    return row;
  }),
  upsert: vi.fn(async ({ where, create }: { where: { userId_dedupeKey: { userId: string; dedupeKey: string } }; create: Record<string, unknown> }) => {
    const existing = store.rows.find(
      (row) =>
        row.userId === where.userId_dedupeKey.userId &&
        row.dedupeKey === where.userId_dedupeKey.dedupeKey,
    );
    if (existing) return existing;
    return notification.create({ data: create });
  }),
  findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
    store.rows
      .filter((row) => matches(row, where))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take),
  ),
  count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.rows.filter((row) => matches(row, where)).length,
  ),
  updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const rows = store.rows.filter((row) => matches(row, where));
    for (const row of rows) Object.assign(row, data);
    return { count: rows.length };
  }),
};

vi.mock('@/server/db/prisma', () => ({ prisma: { notification } }));

const service = await import('@/server/services/notifications');

beforeEach(() => {
  vi.clearAllMocks();
  store.rows = [];
  next = 0;
});

describe('notifications service', () => {
  it('creates deduped notifications idempotently per user and dedupeKey', async () => {
    const input = {
      type: 'ACHIEVEMENT_UNLOCKED' as const,
      title: 'Unlocked',
      body: 'Nice work',
      dedupeKey: 'achievement:FIRST_MEAL',
    };

    const first = await service.createNotification('u1', input);
    const second = await service.createNotification('u1', input);

    expect(second.id).toBe(first.id);
    expect(store.rows).toHaveLength(1);
  });

  it('lists newest first, filters unread, and clamps the limit', async () => {
    await service.createNotification('u1', {
      type: 'ACHIEVEMENT_UNLOCKED',
      title: 'A',
      body: 'A',
    });
    await service.createNotification('u1', {
      type: 'MILESTONE_COMPLETED',
      title: 'B',
      body: 'B',
    });
    store.rows[0]!.readAt = new Date();

    const rows = await service.listNotifications('u1', { unreadOnly: true, limit: 200 });

    expect(rows.map((row) => row.title)).toEqual(['B']);
    expect(notification.findMany.mock.calls[0]![0].take).toBe(100);
  });

  it('counts and marks unread notifications for the requested user only', async () => {
    await service.createNotification('u1', { type: 'ACHIEVEMENT_UNLOCKED', title: 'A', body: 'A' });
    await service.createNotification('u2', { type: 'ACHIEVEMENT_UNLOCKED', title: 'B', body: 'B' });

    expect(await service.unreadNotificationCount('u1')).toBe(1);
    const result = await service.markNotificationsRead('u1');

    expect(result.count).toBe(1);
    expect(store.rows.find((row) => row.userId === 'u1')!.readAt).toBeInstanceOf(Date);
    expect(store.rows.find((row) => row.userId === 'u2')!.readAt).toBeNull();
  });
});
