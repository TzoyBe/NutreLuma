import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

type Status = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'MISSED' | 'CANCELLED' | 'PAUSED';
type Type =
  | 'TARGET_WEIGHT'
  | 'WEIGHT_LOSS_AMOUNT'
  | 'WEIGHT_GAIN_AMOUNT'
  | 'MEAL_LOGGING_DAYS'
  | 'MEAL_LOGGING_STREAK'
  | 'WEIGH_IN_FREQUENCY'
  | 'CALORIE_TARGET_DAYS'
  | 'PROTEIN_TARGET_DAYS'
  | 'WATER_TARGET_DAYS'
  | 'STEP_TARGET_DAYS'
  | 'ACTIVITY_TARGET'
  | 'CUSTOM_NUMERIC';

interface FakeMilestone {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  type: Type;
  unit: string | null;
  startValue: unknown;
  targetValue: unknown;
  currentValue: unknown;
  dailyThreshold: unknown;
  startDate: Date;
  endDate: Date | null;
  status: Status;
  completedAt: Date | null;
  progressMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const store = {
  milestones: [] as FakeMilestone[],
  currentWeightKg: 82,
  targetWeightKg: 78,
};

let next = 0;
const id = () => `milestone-${(next += 1)}`;
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function row(overrides: Partial<FakeMilestone> = {}): FakeMilestone {
  return {
    id: id(),
    userId: 'u1',
    title: 'Log meals',
    description: null,
    type: 'MEAL_LOGGING_DAYS',
    unit: 'days',
    startValue: 0,
    targetValue: 5,
    currentValue: 0,
    dailyThreshold: null,
    startDate: day('2026-08-07'),
    endDate: day('2026-08-13'),
    status: 'ACTIVE',
    completedAt: null,
    progressMethod: null,
    createdAt: new Date('2026-08-07T10:00:00.000Z'),
    updatedAt: new Date('2026-08-07T10:00:00.000Z'),
    ...overrides,
  };
}

function matchesStatus(actual: Status, filter: unknown): boolean {
  if (!filter) return true;
  if (typeof filter === 'string') return actual === filter;
  const f = filter as { in?: Status[] };
  return f.in ? f.in.includes(actual) : true;
}

function matches(row: FakeMilestone, where: Record<string, unknown>): boolean {
  if (where.id && row.id !== where.id) return false;
  if (where.userId && row.userId !== where.userId) return false;
  if (where.status && !matchesStatus(row.status, where.status)) return false;
  return true;
}

const milestone = {
  create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const saved = row({
      id: id(),
      userId: String(data.userId),
      title: String(data.title),
      description: (data.description as string | null) ?? null,
      type: data.type as Type,
      unit: (data.unit as string | null) ?? null,
      startValue: data.startValue,
      targetValue: data.targetValue,
      currentValue: data.currentValue,
      dailyThreshold: data.dailyThreshold ?? null,
      startDate: data.startDate as Date,
      endDate: (data.endDate as Date | null) ?? null,
      status: (data.status as Status) ?? 'ACTIVE',
    });
    store.milestones.push(saved);
    return saved;
  }),
  findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
    store.milestones.filter((m) => matches(m, where)).slice(0, take),
  ),
  findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.milestones.find((m) => matches(m, where)) ?? null,
  ),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const found = store.milestones.find((m) => m.id === where.id);
    if (!found) throw new Error('missing');
    Object.assign(found, data, { updatedAt: new Date('2026-08-07T11:00:00.000Z') });
    return found;
  }),
  updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const found = store.milestones.filter((m) => matches(m, where));
    for (const item of found) Object.assign(item, data);
    return { count: found.length };
  }),
  count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
    store.milestones.filter((m) => matches(m, where)).length,
  ),
};

const healthProfile = {
  findUnique: vi.fn(async () => ({
    currentWeightKg: store.currentWeightKg,
    targetWeightKg: store.targetWeightKg,
  })),
};

vi.mock('@/server/db/prisma', () => ({ prisma: { milestone, healthProfile } }));

const service = await import('@/server/services/milestones');

beforeEach(() => {
  vi.clearAllMocks();
  store.milestones = [];
  store.currentWeightKg = 82;
  store.targetWeightKg = 78;
  next = 0;
});

describe('createMilestone', () => {
  it('creates a user-scoped target-weight milestone with current profile weight as baseline', async () => {
    const result = await service.createMilestone('u1', {
      title: 'Reach 80 kg',
      type: 'TARGET_WEIGHT',
      targetValue: 80,
      startDate: '2026-08-07',
      endDate: '2026-08-21',
    });

    expect(result.milestone).toMatchObject({
      title: 'Reach 80 kg',
      type: 'TARGET_WEIGHT',
      unit: 'kg',
      startValue: 82,
      currentValue: 82,
      targetValue: 80,
    });
    expect(milestone.create.mock.calls[0]![0].data.userId).toBe('u1');
  });

  it('returns a warning for aggressive weight-rate goals without blocking creation', async () => {
    const result = await service.createMilestone('u1', {
      title: 'Fast loss',
      type: 'TARGET_WEIGHT',
      targetValue: 78,
      startDate: '2026-08-07',
      endDate: '2026-08-14',
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      code: 'AGGRESSIVE_WEIGHT_RATE',
      weeklyRateKg: 4,
    });
    expect(store.milestones).toHaveLength(1);
  });

  it('rejects invalid ranges and missing step thresholds before hitting Prisma', async () => {
    await expect(
      service.createMilestone('u1', {
        title: 'Bad range',
        type: 'MEAL_LOGGING_DAYS',
        targetValue: 5,
        startDate: '2026-08-08',
        endDate: '2026-08-07',
      }),
    ).rejects.toBeInstanceOf(ZodError);

    await expect(
      service.createMilestone('u1', {
        title: 'Steps',
        type: 'STEP_TARGET_DAYS',
        targetValue: 5,
        startDate: '2026-08-07',
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(milestone.create).not.toHaveBeenCalled();
  });
});

describe('milestone CRUD ownership', () => {
  it('lists only milestones for the requested user and optional status', async () => {
    store.milestones.push(
      row({ id: 'm1', userId: 'u1', status: 'ACTIVE' }),
      row({ id: 'm2', userId: 'u1', status: 'PAUSED' }),
      row({ id: 'm3', userId: 'u2', status: 'ACTIVE' }),
    );

    const rows = await service.listMilestones('u1', { status: 'ACTIVE', limit: 10 });

    expect(rows.map((m) => m.id)).toEqual(['m1']);
    expect(milestone.findMany.mock.calls[0]![0].where).toMatchObject({
      userId: 'u1',
      status: 'ACTIVE',
    });
  });

  it('returns NOT_FOUND for cross-user get/update access', async () => {
    store.milestones.push(row({ id: 'm1', userId: 'u2' }));

    await expect(service.getMilestoneForUser('u1', 'm1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.updateMilestone('u1', 'm1', { title: 'Nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('updates only editable milestones', async () => {
    store.milestones.push(row({ id: 'm1', userId: 'u1', title: 'Old' }));

    const result = await service.updateMilestone('u1', 'm1', { title: 'New', targetValue: 8 });

    expect(result.milestone.title).toBe('New');
    expect(result.milestone.targetValue).toBe(8);
  });

  it('pauses, resumes, and cancels with user ownership', async () => {
    store.milestones.push(row({ id: 'm1', userId: 'u1', status: 'ACTIVE' }));

    expect((await service.pauseMilestone('u1', 'm1')).status).toBe('PAUSED');
    expect((await service.resumeMilestone('u1', 'm1')).status).toBe('ACTIVE');
    expect((await service.cancelMilestone('u1', 'm1')).status).toBe('CANCELLED');

    await expect(service.pauseMilestone('u2', 'm1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('suggestMilestones', () => {
  it('returns deterministic suggestions with a one-week window and profile target weight', async () => {
    const suggestions = await service.suggestMilestones('u1', '2026-08-07');

    expect(suggestions[0]).toMatchObject({
      type: 'TARGET_WEIGHT',
      targetValue: 78,
      startDate: '2026-08-07',
      endDate: '2026-08-13',
    });
    expect(suggestions.map((s) => s.type)).toContain('WATER_TARGET_DAYS');
  });
});
