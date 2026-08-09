import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccessStateMock = vi.fn();
vi.mock('@/server/services/subscription', () => ({
  getAccessState: (...a: unknown[]) => getAccessStateMock(...(a as [])),
}));
vi.mock('@/server/db/prisma', () => ({ prisma: {} }));

const { requireWriteAccess } = await import('@/server/auth/guards');
const { ApiError } = await import('@/server/errors');

beforeEach(() => getAccessStateMock.mockReset());

describe('requireWriteAccess', () => {
  it('επιτρέπει όταν η κατάσταση δίνει δικαίωμα εγγραφής', async () => {
    getAccessStateMock.mockResolvedValue({ kind: 'TRIAL', canWrite: true });
    await expect(requireWriteAccess('user-1')).resolves.toBeUndefined();
  });

  it('επιτρέπει στην περίοδο χάριτος', async () => {
    getAccessStateMock.mockResolvedValue({ kind: 'GRACE', canWrite: true });
    await expect(requireWriteAccess('user-1')).resolves.toBeUndefined();
  });

  it('πετάει SUBSCRIPTION_REQUIRED με 402 όταν είναι κλειδωμένος', async () => {
    getAccessStateMock.mockResolvedValue({ kind: 'LOCKED', canWrite: false });
    await expect(requireWriteAccess('user-1')).rejects.toBeInstanceOf(ApiError);
    await expect(requireWriteAccess('user-1')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_REQUIRED',
      status: 402,
    });
  });
});
