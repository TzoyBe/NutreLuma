import { beforeEach, describe, expect, it, vi } from 'vitest';

const user = {
  findMany: vi.fn(async () => [
    {
      id: 'u1',
      email: 'a@b.c',
      passwordHash: 'super-secret-hash',
      role: 'USER',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    },
  ]),
  count: vi.fn(async () => 1),
  update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'u1', ...args.data })),
  delete: vi.fn(async () => ({ id: 'u1' })),
};

vi.mock('@/server/db/prisma', () => ({ prisma: { user } }));

const service = await import('@/server/services/admin-db');

beforeEach(() => vi.clearAllMocks());

describe('admin-db service', () => {
  it('rejects unknown models (whitelist)', async () => {
    await expect(service.listRows('DefinitelyNotAModel', { page: 1, pageSize: 25 })).rejects.toThrow();
  });

  it('masks sensitive fields in list output', async () => {
    const res = await service.listRows('User', { page: 1, pageSize: 25 });
    expect(res.rows[0]!.passwordHash).toBe('••••');
    expect(res.rows[0]!.email).toBe('a@b.c');
    // Date serialized to ISO string
    expect(res.rows[0]!.createdAt).toBe('2026-08-01T00:00:00.000Z');
    expect(res.total).toBe(1);
  });

  it('paginates with take/skip', async () => {
    await service.listRows('User', { page: 3, pageSize: 10 });
    expect(user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 20 }));
  });

  it('strips read-only and unknown fields from updates', async () => {
    await service.updateRow(
      'User',
      'u1',
      { email: 'new@b.c', role: 'ADMIN', id: 'hacked', createdAt: '2020-01-01', bogus: 'x' },
      'admin1',
    );
    const call = user.update.mock.calls[0]![0] as { where: unknown; data: Record<string, unknown> };
    expect(call.where).toEqual({ id: 'u1' });
    expect(Object.keys(call.data).sort()).toEqual(['email', 'role']);
    expect(call.data.id).toBeUndefined();
    expect(call.data.createdAt).toBeUndefined();
  });

  it('throws when no editable fields are provided', async () => {
    await expect(service.updateRow('User', 'u1', { id: 'x', createdAt: 'y' }, 'admin1')).rejects.toThrow();
  });

  it('deletes by primary key', async () => {
    await service.deleteRow('User', 'u1', 'admin1');
    expect(user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
