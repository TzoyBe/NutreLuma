import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  syncRevenueCatSubscription: vi.fn(),
  getBillingOverview: vi.fn(),
}));

vi.mock('@/server/auth/guards', () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock('@/server/services/subscription', () => ({
  syncRevenueCatSubscription: mocks.syncRevenueCatSubscription,
  getBillingOverview: mocks.getBillingOverview,
}));

const { ApiError } = await import('@/server/errors');
const { POST } = await import('@/app/api/billing/revenuecat/sync/route');

describe('POST /api/billing/revenuecat/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs and returns billing for the authenticated user, ignoring body user IDs', async () => {
    const overview = { status: 'ACTIVE', provider: 'REVENUECAT' };
    mocks.requireApiUser.mockResolvedValue({ id: 'user-1' });
    mocks.syncRevenueCatSubscription.mockResolvedValue(undefined);
    mocks.getBillingOverview.mockResolvedValue(overview);

    const response = await POST(
      new Request('https://www.nutreluma.com/api/billing/revenuecat/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'attacker-user' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncRevenueCatSubscription).toHaveBeenCalledWith('user-1');
    expect(mocks.getBillingOverview).toHaveBeenCalledWith('user-1');
    expect(await response.json()).toEqual({ ok: true, data: overview });
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mocks.requireApiUser.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required.'));

    const response = await POST(
      new Request('https://www.nutreluma.com/api/billing/revenuecat/sync', { method: 'POST' }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' },
    });
    expect(mocks.syncRevenueCatSubscription).not.toHaveBeenCalled();
    expect(mocks.getBillingOverview).not.toHaveBeenCalled();
  });
});
