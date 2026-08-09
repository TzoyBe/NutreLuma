import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

interface WaterRow {
  id: string;
  userId: string;
  entryDate: Date;
  volumeMl: number;
  createdAt: Date;
}

interface ActivityRow {
  id: string;
  userId: string;
  entryDate: Date;
  kind: 'WORKOUT' | 'WALK' | 'RUN' | 'CYCLE' | 'OTHER';
  steps: number | null;
  durationMin: number | null;
  note: string | null;
  createdAt: Date;
}

const store = {
  water: [] as WaterRow[],
  activity: [] as ActivityRow[],
};

let next = 0;
const id = (prefix: string) => `${prefix}-${(next += 1)}`;
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function dateMatches(actual: Date, filter: unknown): boolean {
  if (!filter || typeof filter !== 'object') return true;
  const range = filter as { gte?: Date; lte?: Date };
  if (range.gte && actual < range.gte) return false;
  if (range.lte && actual > range.lte) return false;
  return true;
}

const waterEntry = {
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row: WaterRow = {
      id: id('water'),
      userId: String(data.userId),
      entryDate: data.entryDate as Date,
      volumeMl: Number(data.volumeMl),
      createdAt: new Date('2026-08-07T10:00:00.000Z'),
    };
    store.water.push(row);
    return row;
  }),
  findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
    store.water
      .filter((row) => row.userId === where.userId)
      .filter((row) => dateMatches(row.entryDate, where.entryDate))
      .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
      .slice(0, take),
  ),
  deleteMany: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
    const before = store.water.length;
    store.water = store.water.filter((row) => row.id !== where.id || row.userId !== where.userId);
    return { count: before - store.water.length };
  }),
};

const activityEntry = {
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row: ActivityRow = {
      id: id('activity'),
      userId: String(data.userId),
      entryDate: data.entryDate as Date,
      kind: data.kind as ActivityRow['kind'],
      steps: (data.steps as number | null) ?? null,
      durationMin: (data.durationMin as number | null) ?? null,
      note: (data.note as string | null) ?? null,
      createdAt: new Date('2026-08-07T10:05:00.000Z'),
    };
    store.activity.push(row);
    return row;
  }),
  findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
    store.activity
      .filter((row) => row.userId === where.userId)
      .filter((row) => dateMatches(row.entryDate, where.entryDate))
      .filter((row) => {
        const steps = where.steps as { not?: null } | undefined;
        return !steps || steps.not !== null || row.steps !== null;
      })
      .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
      .slice(0, take),
  ),
  deleteMany: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
    const before = store.activity.length;
    store.activity = store.activity.filter(
      (row) => row.id !== where.id || row.userId !== where.userId,
    );
    return { count: before - store.activity.length };
  }),
};

vi.mock('@/server/db/prisma', () => ({ prisma: { waterEntry, activityEntry } }));

const water = await import('@/server/services/water');
const activity = await import('@/server/services/activity');

beforeEach(() => {
  vi.clearAllMocks();
  store.water = [];
  store.activity = [];
  next = 0;
});

describe('water tracking service', () => {
  it('validates input and stores a UTC date-only entry for the user', async () => {
    const saved = await water.addWaterEntry('u1', { entryDate: '2026-08-07', volumeMl: 500 });

    expect(saved).toMatchObject({ entryDate: '2026-08-07', volumeMl: 500 });
    const data = waterEntry.create.mock.calls[0]![0].data as { entryDate: Date };
    expect(data).toMatchObject({ userId: 'u1', volumeMl: 500 });
    expect(data.entryDate.toISOString()).toBe('2026-08-07T00:00:00.000Z');
  });

  it('rejects unrealistic or invalid water entries before hitting Prisma', async () => {
    await expect(
      water.addWaterEntry('u1', { entryDate: '2026-02-31', volumeMl: 250 } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      water.addWaterEntry('u1', { entryDate: '2026-08-07', volumeMl: 20001 } as never),
    ).rejects.toBeInstanceOf(ZodError);
    expect(waterEntry.create).not.toHaveBeenCalled();
  });

  it('lists only the requested user in the date range and applies the bounded limit', async () => {
    store.water.push(
      { id: 'w1', userId: 'u1', entryDate: day('2026-08-05'), volumeMl: 200, createdAt: day('2026-08-05') },
      { id: 'w2', userId: 'u1', entryDate: day('2026-08-07'), volumeMl: 300, createdAt: day('2026-08-07') },
      { id: 'w3', userId: 'u2', entryDate: day('2026-08-07'), volumeMl: 999, createdAt: day('2026-08-07') },
    );

    const entries = await water.listWaterEntries('u1', {
      from: '2026-08-06',
      to: '2026-08-07',
      limit: 10,
    });

    expect(entries.map((entry) => entry.id)).toEqual(['w2']);
    expect(waterEntry.findMany.mock.calls[0][0].where.userId).toBe('u1');
  });

  it('deletes with user ownership and reports NOT_FOUND across users', async () => {
    store.water.push({
      id: 'w1',
      userId: 'u2',
      entryDate: day('2026-08-07'),
      volumeMl: 500,
      createdAt: day('2026-08-07'),
    });

    await expect(water.deleteWaterEntry('u1', 'w1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(store.water).toHaveLength(1);
  });

  it('aggregates water milliliters by day for the requested user only', async () => {
    store.water.push(
      { id: 'w1', userId: 'u1', entryDate: day('2026-08-07'), volumeMl: 250, createdAt: day('2026-08-07') },
      { id: 'w2', userId: 'u1', entryDate: day('2026-08-07'), volumeMl: 500, createdAt: day('2026-08-07') },
      { id: 'w3', userId: 'u2', entryDate: day('2026-08-07'), volumeMl: 999, createdAt: day('2026-08-07') },
    );

    const byDay = await water.waterMlByDay('u1', '2026-08-07', '2026-08-07');

    expect(byDay.get('2026-08-07')).toBe(750);
  });
});

describe('activity tracking service', () => {
  it('validates input, trims notes, and defaults nullable fields', async () => {
    const saved = await activity.addActivityEntry('u1', {
      entryDate: '2026-08-07',
      kind: 'WALK',
      steps: 6200,
      note: '  evening walk  ',
    });

    expect(saved).toMatchObject({
      entryDate: '2026-08-07',
      kind: 'WALK',
      steps: 6200,
      durationMin: null,
      note: 'evening walk',
    });
  });

  it('rejects entries without measurable activity before hitting Prisma', async () => {
    await expect(
      activity.addActivityEntry('u1', { entryDate: '2026-08-07', kind: 'OTHER' } as never),
    ).rejects.toBeInstanceOf(ZodError);
    expect(activityEntry.create).not.toHaveBeenCalled();
  });

  it('lists only the requested user in range', async () => {
    store.activity.push(
      {
        id: 'a1',
        userId: 'u1',
        entryDate: day('2026-08-06'),
        kind: 'RUN',
        steps: 8000,
        durationMin: 40,
        note: null,
        createdAt: day('2026-08-06'),
      },
      {
        id: 'a2',
        userId: 'u2',
        entryDate: day('2026-08-06'),
        kind: 'WALK',
        steps: 1000,
        durationMin: 10,
        note: null,
        createdAt: day('2026-08-06'),
      },
    );

    const entries = await activity.listActivityEntries('u1', {
      from: '2026-08-06',
      to: '2026-08-06',
      limit: 10,
    });

    expect(entries.map((entry) => entry.id)).toEqual(['a1']);
    expect(activityEntry.findMany.mock.calls[0][0].where.userId).toBe('u1');
  });

  it('aggregates steps by day and returns distinct active days', async () => {
    store.activity.push(
      {
        id: 'a1',
        userId: 'u1',
        entryDate: day('2026-08-07'),
        kind: 'WALK',
        steps: 3000,
        durationMin: null,
        note: null,
        createdAt: day('2026-08-07'),
      },
      {
        id: 'a2',
        userId: 'u1',
        entryDate: day('2026-08-07'),
        kind: 'RUN',
        steps: 4500,
        durationMin: 25,
        note: null,
        createdAt: day('2026-08-07'),
      },
      {
        id: 'a3',
        userId: 'u1',
        entryDate: day('2026-08-08'),
        kind: 'OTHER',
        steps: null,
        durationMin: 15,
        note: null,
        createdAt: day('2026-08-08'),
      },
    );

    const steps = await activity.stepsByDay('u1', '2026-08-07', '2026-08-08');
    const days = await activity.activeDays('u1', '2026-08-07', '2026-08-08');

    expect(steps.get('2026-08-07')).toBe(7500);
    expect(steps.has('2026-08-08')).toBe(false);
    expect(days).toEqual(['2026-08-07', '2026-08-08']);
  });

  it('deletes with user ownership and reports NOT_FOUND across users', async () => {
    store.activity.push({
      id: 'a1',
      userId: 'u2',
      entryDate: day('2026-08-07'),
      kind: 'WALK',
      steps: 1000,
      durationMin: null,
      note: null,
      createdAt: day('2026-08-07'),
    });

    await expect(activity.deleteActivityEntry('u1', 'a1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(store.activity).toHaveLength(1);
  });
});
