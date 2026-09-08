import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.REVENUECAT_SECRET_API_KEY = 'rc-secret-test';
process.env.REVENUECAT_ENTITLEMENT_ID = 'pro';
process.env.REVENUECAT_PRODUCT_IDS = 'nutreluma_pro_monthly,nutreluma_pro_yearly';
delete process.env.REVENUECAT_ALLOW_SANDBOX;

const { getRevenueCatSubscription, RevenueCatError } = await import('@/server/billing/revenuecat');

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function subscriberFixture(overrides: {
  productId?: string;
  entitlement?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
} = {}) {
  const productId = overrides.productId ?? 'nutreluma_pro_monthly';
  return {
    subscriber: {
      entitlements: {
        pro: {
          product_identifier: productId,
          expires_date: '2030-01-31T00:00:00Z',
          ...(overrides.entitlement ?? {}),
        },
      },
      subscriptions: {
        [productId]: {
          expires_date: '2030-01-31T00:00:00Z',
          grace_period_expires_date: null,
          store: 'play_store',
          store_transaction_id: 'GPA.1234',
          purchase_date: '2030-01-01T00:00:00Z',
          unsubscribe_detected_at: null,
          refunded_at: null,
          is_sandbox: false,
          ...(overrides.subscription ?? {}),
        },
      },
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('getRevenueCatSubscription', () => {
  it('maps the configured active entitlement and authenticates the encoded request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(subscriberFixture()));
    vi.stubGlobal('fetch', fetchMock);

    const active = await getRevenueCatSubscription('user/1');

    expect(active).toMatchObject({
      appUserId: 'user/1',
      active: true,
      cancelled: false,
      productId: 'nutreluma_pro_monthly',
      store: 'play_store',
      transactionId: 'GPA.1234',
    });
    expect(active.accessUntil?.toISOString()).toBe('2030-01-31T00:00:00.000Z');
    expect(active.purchasedAt?.toISOString()).toBe('2030-01-01T00:00:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%2F1',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer rc-secret-test' }),
      }),
    );
  });

  it('keeps an unsubscribed entitlement active until its effective expiry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok(subscriberFixture({ subscription: { unsubscribe_detected_at: '2029-12-01T00:00:00Z' } })),
      ),
    );

    const subscription = await getRevenueCatSubscription('user-1');

    expect(subscription.cancelled).toBe(true);
    expect(subscription.active).toBe(true);
    expect(subscription.accessUntil?.toISOString()).toBe('2030-01-31T00:00:00.000Z');
  });

  it('uses the later grace-period expiry as the effective access end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok(
          subscriberFixture({
            entitlement: { expires_date: '2000-01-01T00:00:00Z' },
            subscription: {
              expires_date: '2000-01-01T00:00:00Z',
              grace_period_expires_date: '2030-02-03T00:00:00Z',
            },
          }),
        ),
      ),
    );

    const subscription = await getRevenueCatSubscription('user-1');

    expect(subscription.active).toBe(true);
    expect(subscription.accessUntil?.toISOString()).toBe('2030-02-03T00:00:00.000Z');
  });

  it('marks a refunded entitlement cancelled and inactive after its effective end', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok(
          subscriberFixture({
            entitlement: { expires_date: '2000-01-01T00:00:00Z' },
            subscription: {
              expires_date: '2000-01-01T00:00:00Z',
              refunded_at: '2000-01-02T00:00:00Z',
            },
          }),
        ),
      ),
    );

    const subscription = await getRevenueCatSubscription('user-1');

    expect(subscription.cancelled).toBe(true);
    expect(subscription.active).toBe(false);
  });

  it('marks an expired entitlement inactive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok(
          subscriberFixture({
            entitlement: { expires_date: '2000-01-01T00:00:00Z' },
            subscription: { expires_date: '2000-01-01T00:00:00Z' },
          }),
        ),
      ),
    );

    await expect(getRevenueCatSubscription('user-1')).resolves.toMatchObject({ active: false });
  });

  it('rejects a product outside the configured allow-list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok(
          subscriberFixture({
            productId: 'untrusted_product',
          }),
        ),
      ),
    );

    await expect(getRevenueCatSubscription('user-1')).rejects.toBeInstanceOf(RevenueCatError);
  });

  it('rejects sandbox purchases unless they are explicitly allowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(subscriberFixture({ subscription: { is_sandbox: true } }))));

    await expect(getRevenueCatSubscription('user-1')).rejects.toBeInstanceOf(RevenueCatError);
  });

  it('rejects malformed effective access dates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok(
          subscriberFixture({
            entitlement: { expires_date: 'not-a-date' },
            subscription: { expires_date: 'not-a-date' },
          }),
        ),
      ),
    );

    await expect(getRevenueCatSubscription('user-1')).rejects.toBeInstanceOf(RevenueCatError);
  });

  it('rejects an entitlement with no expiry field', async () => {
    const body = subscriberFixture();
    delete (body.subscriber.entitlements.pro as Record<string, unknown>).expires_date;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(body)));

    await expect(getRevenueCatSubscription('user-1')).rejects.toBeInstanceOf(RevenueCatError);
  });

  it('wraps non-success RevenueCat responses in a provider error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ error: 'not found' }, 404)));

    await expect(getRevenueCatSubscription('user-1')).rejects.toBeInstanceOf(RevenueCatError);
  });

  it('wraps request timeouts in a provider error', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException('The operation timed out', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getRevenueCatSubscription('user-1')).rejects.toBeInstanceOf(RevenueCatError);
  });
});
