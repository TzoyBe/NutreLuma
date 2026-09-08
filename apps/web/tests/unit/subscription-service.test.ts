import { beforeEach, describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;

// Ορίζονται ΠΡΙΝ από κάθε import του server env, αλλιώς η επαλήθευση πλάνου
// θα συνέκρινε με κενή τιμή και το test θα περνούσε για λάθος λόγο.
process.env.PAYPAL_CLIENT_ID = 'client-id-test';
process.env.PAYPAL_CLIENT_SECRET = 'client-secret-test';
process.env.PAYPAL_PLAN_ID = 'P-TESTPLAN';


interface FakeSub {
  userId: string;
  status: string;
  provider: string | null;
  accessUntil: Date;
  autoRenew: boolean;
  externalId: string | null;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  cancelledAt: Date | null;
  updatedAt: Date;
}

const store: {
  subs: FakeSub[];
  payments: Array<Record<string, unknown>>;
  users: Array<{ id: string; role: string }>;
} = { subs: [], payments: [], users: [] };

const fakePrisma = {
  user: {
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        store.users.find((u) => u.id === where.id) ?? null,
    ),
  },
  subscription: {
    findUnique: vi.fn(
      async ({ where }: { where: { userId?: string; externalId?: string } }) => {
        const sub = store.subs.find(
          (s) =>
            (where.userId !== undefined && s.userId === where.userId) ||
            (where.externalId !== undefined && s.externalId === where.externalId),
        );
        return sub ? { ...sub } : null;
      },
    ),
    update: vi.fn(
      async ({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) => {
        const sub = store.subs.find((s) => s.userId === where.userId)!;
        Object.assign(sub, data);
        return sub;
      },
    ),
    updateMany: vi.fn(async ({ where, data }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const sub = store.subs.find((candidate) => Object.entries(where).every(([key, expected]) => {
        const actual = candidate[key as keyof FakeSub];
        return actual instanceof Date && expected instanceof Date
          ? actual.getTime() === expected.getTime()
          : actual === expected;
      }));
      if (!sub) return { count: 0 };
      Object.assign(sub, data);
      return { count: 1 };
    }),
  },
  payment: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.externalId && store.payments.some((p) => p.externalId === data.externalId)) {
        const error = new Error('Unique constraint failed') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      }
      store.payments.push(data);
      return data;
    }),
    findMany: vi.fn(async () => store.payments),
  },
};

vi.mock('@/server/db/prisma', () => ({ prisma: fakePrisma }));

const getSubscriptionMock = vi.fn();
const getCheckoutSessionMock = vi.fn();
const cancelAtPeriodEndMock = vi.fn(async () => undefined);

vi.mock('@/server/billing/stripe', () => ({
  getSubscription: (...a: unknown[]) => getSubscriptionMock(...(a as [])),
  getCheckoutSession: (...a: unknown[]) => getCheckoutSessionMock(...(a as [])),
  cancelAtPeriodEnd: (...a: unknown[]) => cancelAtPeriodEndMock(...(a as [])),
  createCheckoutSession: vi.fn(),
  StripeError: class StripeError extends Error {
    detail = '';
  },
}));

const getPayPalSubscriptionMock = vi.fn();
const cancelPayPalMock = vi.fn(async () => undefined);

vi.mock('@/server/billing/paypal', () => ({
  getSubscription: (...a: unknown[]) => getPayPalSubscriptionMock(...(a as [])),
  cancelSubscription: (...a: unknown[]) => cancelPayPalMock(...(a as [])),
  PayPalError: class PayPalError extends Error {
    detail = '';
  },
}));

const getRevenueCatSubscriptionMock = vi.fn();

vi.mock('@/server/billing/revenuecat', () => ({
  getRevenueCatSubscription: (...args: unknown[]) =>
    getRevenueCatSubscriptionMock(...(args as [string])),
}));

const {
  getAccessState,
  reconcileSubscription,
  syncRevenueCatSubscription,
  extendManually,
  attachStripeCheckout,
  attachPayPalSubscription,
} =
  await import('@/server/services/subscription');

beforeEach(() => {
  store.subs = [];
  store.payments = [];
  store.users = [{ id: 'user-1', role: 'USER' }];
  getSubscriptionMock.mockReset();
  getCheckoutSessionMock.mockReset();
  cancelAtPeriodEndMock.mockClear();
  getPayPalSubscriptionMock.mockReset();
  cancelPayPalMock.mockClear();
  getRevenueCatSubscriptionMock.mockReset();
});

function seedSub(overrides: Partial<FakeSub> = {}) {
  store.subs.push({
    userId: 'user-1',
    status: 'TRIALING',
    provider: null,
    accessUntil: new Date(Date.now() + 2 * DAY),
    autoRenew: false,
    externalId: null,
    lastSyncedAt: null,
    lastSyncError: null,
    cancelledAt: null,
    updatedAt: new Date(Date.now() - DAY),
    ...overrides,
  });
}

function activeStripeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    ownerUserId: 'user-1',
    currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    cancelAtPeriodEnd: false,
    latestInvoice: { id: 'in_1', amountPaidCents: 300, paidAt: new Date() },
    ...overrides,
  };
}

function revenueCatSub(overrides: Record<string, unknown> = {}) {
  return {
    appUserId: 'user-1',
    active: true,
    cancelled: false,
    accessUntil: new Date(Date.now() + 30 * DAY),
    productId: 'nutreluma_pro_monthly',
    store: 'app_store' as const,
    transactionId: 'transaction-1',
    purchasedAt: new Date(Date.now() - DAY),
    ...overrides,
  };
}

describe('getAccessState', () => {
  it('επιστρέφει TRIAL για ενεργή δοκιμή χωρίς κλήση Stripe', async () => {
    seedSub();
    const state = await getAccessState('user-1');
    expect(state.kind).toBe('TRIAL');
    expect(getSubscriptionMock).not.toHaveBeenCalled();
  });

  it('ο ADMIN δεν ελέγχεται καθόλου', async () => {
    store.users = [{ id: 'user-1', role: 'ADMIN' }];
    const state = await getAccessState('user-1');
    expect(state.kind).toBe('UNLIMITED');
  });
});

describe('reconcileSubscription', () => {
  it('ανανεώνει το accessUntil όταν το Stripe λέει active', async () => {
    const next = new Date(Date.now() + 30 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(activeStripeSub({ currentPeriodEnd: next }));

    const state = await reconcileSubscription('user-1');
    expect(state.canWrite).toBe(true);
    expect(store.subs[0].accessUntil.getTime()).toBe(next.getTime());
    expect(store.payments).toHaveLength(1);
    expect(store.payments[0].externalId).toBe('in_1');
  });

  it('δεν καταγράφει δεύτερη φορά το ίδιο τιμολόγιο', async () => {
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(activeStripeSub());

    await reconcileSubscription('user-1');
    store.subs[0].lastSyncedAt = null;
    store.subs[0].accessUntil = new Date(Date.now() - DAY);
    await reconcileSubscription('user-1');

    expect(store.payments).toHaveLength(1);
  });

  it('σε σφάλμα Stripe δεν αλλάζει το accessUntil', async () => {
    const expired = new Date(Date.now() - DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: expired,
    });
    getSubscriptionMock.mockRejectedValue(new Error('network down'));

    const state = await reconcileSubscription('user-1');
    expect(store.subs[0].accessUntil.getTime()).toBe(expired.getTime());
    expect(state.kind).toBe('GRACE');
  });

  it('χρησιμοποιεί fallback +1 μήνα όταν λείπει το current_period_end', async () => {
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(
      activeStripeSub({ currentPeriodEnd: null, latestInvoice: null }),
    );

    await reconcileSubscription('user-1');
    expect(store.subs[0].accessUntil.getTime()).toBeGreaterThan(Date.now() + 27 * DAY);
  });

  it('το cancel_at_period_end γίνεται CANCELLED χωρίς απώλεια χρόνου', async () => {
    const until = new Date(Date.now() + 5 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'STRIPE',
      autoRenew: true,
      externalId: 'sub_1',
      accessUntil: new Date(Date.now() - DAY),
    });
    getSubscriptionMock.mockResolvedValue(
      activeStripeSub({ cancelAtPeriodEnd: true, currentPeriodEnd: until }),
    );

    await reconcileSubscription('user-1');
    expect(store.subs[0].status).toBe('CANCELLED');
    expect(store.subs[0].autoRenew).toBe(false);
    expect(store.subs[0].accessUntil.getTime()).toBe(until.getTime());
  });
});

describe('syncRevenueCatSubscription', () => {
  it.each(['STRIPE', 'PAYPAL', 'MANUAL'])(
    'leaves expired %s ownership untouched for an inactive RevenueCat response',
    async (provider) => {
      seedSub({ provider, externalId: 'original-id', status: 'EXPIRED', accessUntil: new Date(Date.now() - DAY) });
      const original = { ...store.subs[0] };
      getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub({ active: false }));

      await syncRevenueCatSubscription('user-1');

      expect(store.subs[0]).toEqual(original);
    },
  );

  it.each(['STRIPE', 'PAYPAL', 'MANUAL'])(
    'preserves %s activated while the RevenueCat request is in flight',
    async (provider) => {
      seedSub({ status: 'EXPIRED', accessUntil: new Date(Date.now() - DAY) });
      getRevenueCatSubscriptionMock.mockImplementation(async () => {
        Object.assign(store.subs[0], { provider, externalId: 'new-provider-id', status: 'ACTIVE', accessUntil: new Date(Date.now() + 10 * DAY) });
        return revenueCatSub();
      });

      await syncRevenueCatSubscription('user-1');

      expect(store.subs[0]).toMatchObject({ provider, externalId: 'new-provider-id', status: 'ACTIVE' });
    },
  );

  it('discards an older in-flight snapshot after a newer sync changes renewal metadata', async () => {
    const until = new Date(Date.now() + 30 * DAY);
    seedSub({ provider: 'REVENUECAT', externalId: 'user-1', status: 'ACTIVE', accessUntil: until, autoRenew: true });
    let resolveOlder!: (value: ReturnType<typeof revenueCatSub>) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => { started = resolve; });
    getRevenueCatSubscriptionMock.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => { resolveOlder = resolve; });
    }).mockResolvedValueOnce(revenueCatSub({ cancelled: true, accessUntil: until }));

    const olderSync = syncRevenueCatSubscription('user-1');
    await requestStarted;
    await syncRevenueCatSubscription('user-1');
    resolveOlder(revenueCatSub({ accessUntil: new Date(Date.now() + 5 * DAY) }));
    await olderSync;

    expect(store.subs[0]).toMatchObject({ provider: 'REVENUECAT', externalId: 'user-1', status: 'CANCELLED', autoRenew: false, accessUntil: until });
  });

  it('never shortens cached access for a shorter active RevenueCat snapshot', async () => {
    const until = new Date(Date.now() + 30 * DAY);
    seedSub({ provider: 'REVENUECAT', externalId: 'user-1', status: 'ACTIVE', accessUntil: until });
    getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub({ accessUntil: new Date(Date.now() + DAY) }));

    await syncRevenueCatSubscription('user-1');

    expect(store.subs[0].accessUntil).toEqual(until);
  });

  it('does not overwrite a provider changed during RevenueCat reconciliation', async () => {
    seedSub({ provider: 'REVENUECAT', externalId: 'user-1', status: 'ACTIVE', accessUntil: new Date(Date.now() - DAY) });
    getRevenueCatSubscriptionMock.mockImplementation(async () => {
      Object.assign(store.subs[0], { provider: 'MANUAL', externalId: null, status: 'ACTIVE', accessUntil: new Date(Date.now() + 30 * DAY) });
      return revenueCatSub({ active: false });
    });

    await reconcileSubscription('user-1');

    expect(store.subs[0]).toMatchObject({ provider: 'MANUAL', externalId: null, status: 'ACTIVE' });
  });

  it('does not let an older Stripe reconciliation overwrite a RevenueCat claim', async () => {
    seedSub({ provider: 'STRIPE', externalId: 'sub_1', status: 'EXPIRED', accessUntil: new Date(Date.now() - 10 * DAY) });
    getSubscriptionMock.mockImplementation(async () => {
      getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub());
      await syncRevenueCatSubscription('user-1');
      return activeStripeSub();
    });

    await reconcileSubscription('user-1');

    expect(store.subs[0]).toMatchObject({ provider: 'REVENUECAT', externalId: 'user-1', status: 'ACTIVE' });
    expect(store.payments).toHaveLength(0);
  });

  it('records active RevenueCat access without creating a payment', async () => {
    const accessUntil = new Date(Date.now() + 30 * DAY);
    seedSub({ status: 'EXPIRED', accessUntil: new Date(Date.now() - DAY) });
    getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub({ accessUntil }));

    const state = await syncRevenueCatSubscription('user-1');

    expect(getRevenueCatSubscriptionMock).toHaveBeenCalledWith('user-1');
    expect(store.subs[0]).toMatchObject({
      provider: 'REVENUECAT',
      externalId: 'user-1',
      status: 'ACTIVE',
      autoRenew: true,
    });
    expect(store.subs[0].accessUntil.getTime()).toBe(accessUntil.getTime());
    expect(state.kind).toBe('ACTIVE');
    expect(store.payments).toHaveLength(0);
  });

  it('rejects an active RevenueCat lifetime entitlement without an expiry', async () => {
    seedSub({ status: 'EXPIRED', accessUntil: new Date(Date.now() - DAY) });
    getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub({ accessUntil: null }));

    await expect(syncRevenueCatSubscription('user-1')).rejects.toThrow(
      'Unsupported RevenueCat lifetime entitlement',
    );

    expect(store.subs[0]).toMatchObject({ provider: null, externalId: null, status: 'EXPIRED' });
    expect(store.payments).toHaveLength(0);
  });

  it('keeps remaining access when RevenueCat reports cancellation', async () => {
    const accessUntil = new Date(Date.now() + 10 * DAY);
    seedSub({ status: 'EXPIRED', accessUntil: new Date(Date.now() - DAY) });
    getRevenueCatSubscriptionMock.mockResolvedValue(
      revenueCatSub({ cancelled: true, accessUntil }),
    );

    await syncRevenueCatSubscription('user-1');

    expect(store.subs[0]).toMatchObject({ status: 'CANCELLED', autoRenew: false });
    expect(store.subs[0].accessUntil.getTime()).toBe(accessUntil.getTime());
  });

  it('does not shorten a future paid period when RevenueCat is inactive', async () => {
    const paidUntil = new Date(Date.now() + 10 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'REVENUECAT',
      externalId: 'user-1',
      autoRenew: true,
      accessUntil: paidUntil,
    });
    getRevenueCatSubscriptionMock.mockResolvedValue(
      revenueCatSub({ active: false, cancelled: false, accessUntil: new Date(Date.now() - DAY) }),
    );

    await syncRevenueCatSubscription('user-1');

    expect(store.subs[0]).toMatchObject({ status: 'EXPIRED', autoRenew: false });
    expect(store.subs[0].accessUntil.getTime()).toBe(paidUntil.getTime());
  });

  it('reconciles an expired cached RevenueCat subscription', async () => {
    const renewedUntil = new Date(Date.now() + 30 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'REVENUECAT',
      externalId: 'user-1',
      autoRenew: true,
      accessUntil: new Date(Date.now() - DAY),
    });
    getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub({ accessUntil: renewedUntil }));

    const state = await reconcileSubscription('user-1');

    expect(getRevenueCatSubscriptionMock).toHaveBeenCalledWith('user-1');
    expect(store.subs[0].accessUntil.getTime()).toBe(renewedUntil.getTime());
    expect(state.kind).toBe('ACTIVE');
    expect(store.payments).toHaveLength(0);
  });

  it('fails closed when reconciliation receives an active lifetime entitlement', async () => {
    const expired = new Date(Date.now() - DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'REVENUECAT',
      externalId: 'user-1',
      autoRenew: true,
      accessUntil: expired,
    });
    getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub({ accessUntil: null }));

    const state = await reconcileSubscription('user-1');

    expect(store.subs[0].accessUntil.getTime()).toBe(expired.getTime());
    expect(store.subs[0].lastSyncError).toBe('SYNC_FAILED');
    expect(state.kind).toBe('GRACE');
  });

  it('remains payment-free across repeated RevenueCat synchronizations', async () => {
    seedSub({ status: 'EXPIRED', accessUntil: new Date(Date.now() - DAY) });
    getRevenueCatSubscriptionMock.mockResolvedValue(revenueCatSub());

    await syncRevenueCatSubscription('user-1');
    await syncRevenueCatSubscription('user-1');

    expect(store.payments).toHaveLength(0);
  });

  it.each(['STRIPE', 'PAYPAL', 'MANUAL'])(
    'does not replace an active %s subscription',
    async (provider) => {
      const paidUntil = new Date(Date.now() + 10 * DAY);
      seedSub({
        status: 'ACTIVE',
        provider,
        externalId: provider === 'STRIPE' ? 'sub_1' : 'I-ABC',
        autoRenew: provider !== 'MANUAL',
        accessUntil: paidUntil,
      });

      const state = await syncRevenueCatSubscription('user-1');

      expect(getRevenueCatSubscriptionMock).not.toHaveBeenCalled();
      expect(store.subs[0].provider).toBe(provider);
      expect(store.subs[0].accessUntil.getTime()).toBe(paidUntil.getTime());
      expect(state.kind).toBe('ACTIVE');
    },
  );

  it('preserves access when RevenueCat reconciliation fails', async () => {
    const expired = new Date(Date.now() - DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'REVENUECAT',
      externalId: 'user-1',
      autoRenew: true,
      accessUntil: expired,
    });
    getRevenueCatSubscriptionMock.mockRejectedValue(new Error('network down'));

    const state = await reconcileSubscription('user-1');

    expect(store.subs[0].accessUntil.getTime()).toBe(expired.getTime());
    expect(store.subs[0].lastSyncError).toBe('SYNC_FAILED');
    expect(state.kind).toBe('GRACE');
  });
});

describe('attachStripeCheckout', () => {
  it('απορρίπτει συνεδρία που ανήκει σε άλλον χρήστη', async () => {
    seedSub();
    getCheckoutSessionMock.mockResolvedValue({
      id: 'cs_1',
      clientReferenceId: 'someone-else',
      complete: true,
      subscriptionId: 'sub_1',
    });

    await expect(attachStripeCheckout('user-1', 'cs_1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(store.subs[0].provider).toBeNull();
  });

  it('απορρίπτει μη ολοκληρωμένη συνεδρία', async () => {
    seedSub();
    getCheckoutSessionMock.mockResolvedValue({
      id: 'cs_1',
      clientReferenceId: 'user-1',
      complete: false,
      subscriptionId: null,
    });

    await expect(attachStripeCheckout('user-1', 'cs_1')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('ενεργοποιεί τη συνδρομή όταν όλα επαληθεύονται', async () => {
    seedSub();
    getCheckoutSessionMock.mockResolvedValue({
      id: 'cs_1',
      clientReferenceId: 'user-1',
      complete: true,
      subscriptionId: 'sub_1',
    });
    getSubscriptionMock.mockResolvedValue(activeStripeSub());

    await attachStripeCheckout('user-1', 'cs_1');
    expect(store.subs[0].provider).toBe('STRIPE');
    expect(store.subs[0].status).toBe('ACTIVE');
    expect(store.subs[0].externalId).toBe('sub_1');
    expect(store.payments).toHaveLength(1);
  });
});

describe('extendManually', () => {
  it('προσθέτει χρόνο αντί να τον χάνει όταν πληρώνει νωρίς', async () => {
    const future = new Date(Date.now() + 10 * DAY);
    seedSub({ status: 'ACTIVE', provider: 'MANUAL', accessUntil: future });

    await extendManually('user-1', 1, 'IRIS 05/08');

    expect(store.subs[0].accessUntil.getTime()).toBeGreaterThan(future.getTime() + 25 * DAY);
    expect(store.payments).toHaveLength(1);
  });
});

describe('PayPal: επαλήθευση πριν την ενεργοποίηση', () => {
  function paypalSub(overrides: Record<string, unknown> = {}) {
    return {
      id: 'I-ABC',
      status: 'ACTIVE',
      planId: 'P-TESTPLAN',
      ownerUserId: 'user-1',
      nextBillingTime: new Date(Date.now() + 30 * DAY),
      lastPayment: {
        externalId: 'paypal:I-ABC:2026-08-06T10:00:00.000Z',
        amountCents: 300,
        paidAt: new Date(),
      },
      ...overrides,
    };
  }

  beforeEach(() => seedSub({ accessUntil: new Date(Date.now() - DAY), status: 'EXPIRED' }));

  it('ενεργοποιεί όταν όλα επαληθεύονται', async () => {
    getPayPalSubscriptionMock.mockResolvedValue(paypalSub());

    await attachPayPalSubscription('user-1', 'I-ABC');

    const sub = store.subs[0]!;
    expect(sub.provider).toBe('PAYPAL');
    expect(sub.externalId).toBe('I-ABC');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.autoRenew).toBe(true);
    expect(sub.accessUntil.getTime()).toBeGreaterThan(Date.now());
    expect(store.payments).toHaveLength(1);
  });

  it('απορρίπτει συνδρομή άλλου χρήστη (custom_id mismatch)', async () => {
    getPayPalSubscriptionMock.mockResolvedValue(paypalSub({ ownerUserId: 'user-999' }));

    await expect(attachPayPalSubscription('user-1', 'I-ABC')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(store.subs[0]!.provider).toBeNull();
  });

  it('απορρίπτει συνδρομή άλλου πλάνου', async () => {
    getPayPalSubscriptionMock.mockResolvedValue(paypalSub({ planId: 'P-CHEAPER' }));

    await expect(attachPayPalSubscription('user-1', 'I-ABC')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(store.subs[0]!.provider).toBeNull();
  });

  it('απορρίπτει συνδρομή που ανήκει ήδη σε άλλον λογαριασμό', async () => {
    store.subs.push({
      userId: 'user-2',
      status: 'ACTIVE',
      provider: 'PAYPAL',
      accessUntil: new Date(Date.now() + 10 * DAY),
      autoRenew: true,
      externalId: 'I-ABC',
      lastSyncedAt: null,
      lastSyncError: null,
      cancelledAt: null,
      updatedAt: new Date(Date.now() - DAY),
    });
    getPayPalSubscriptionMock.mockResolvedValue(paypalSub());

    await expect(attachPayPalSubscription('user-1', 'I-ABC')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(store.subs[0]!.provider).toBeNull();
  });

  it('απορρίπτει συνδρομή που δεν είναι ακόμη ενεργή', async () => {
    getPayPalSubscriptionMock.mockResolvedValue(paypalSub({ status: 'APPROVAL_PENDING' }));

    await expect(attachPayPalSubscription('user-1', 'I-ABC')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(store.subs[0]!.provider).toBeNull();
  });

  it('η ίδια πληρωμή δεν καταγράφεται δύο φορές', async () => {
    getPayPalSubscriptionMock.mockResolvedValue(paypalSub());

    await attachPayPalSubscription('user-1', 'I-ABC');
    await attachPayPalSubscription('user-1', 'I-ABC');

    expect(store.payments).toHaveLength(1);
  });
});

describe('PayPal: συγχρονισμός', () => {
  it('ανανεώνει την πρόσβαση όταν το PayPal δείχνει νέα περίοδο', async () => {
    seedSub({
      status: 'ACTIVE',
      provider: 'PAYPAL',
      externalId: 'I-ABC',
      autoRenew: true,
      accessUntil: new Date(Date.now() - DAY),
    });
    const nextPeriod = new Date(Date.now() + 29 * DAY);
    getPayPalSubscriptionMock.mockResolvedValue({
      id: 'I-ABC',
      status: 'ACTIVE',
      planId: 'P-TESTPLAN',
      ownerUserId: 'user-1',
      nextBillingTime: nextPeriod,
      lastPayment: null,
    });

    await reconcileSubscription('user-1');

    expect(store.subs[0]!.accessUntil.getTime()).toBe(nextPeriod.getTime());
    expect(getPayPalSubscriptionMock).toHaveBeenCalledWith('I-ABC');
  });

  it('ακυρωμένη συνδρομή δεν χάνει την πληρωμένη περίοδο', async () => {
    const paidUntil = new Date(Date.now() + 10 * DAY);
    seedSub({
      status: 'ACTIVE',
      provider: 'PAYPAL',
      externalId: 'I-ABC',
      autoRenew: true,
      accessUntil: new Date(Date.now() - DAY),
    });
    store.subs[0]!.accessUntil = new Date(Date.now() - DAY);

    getPayPalSubscriptionMock.mockResolvedValue({
      id: 'I-ABC',
      status: 'CANCELLED',
      planId: 'P-TESTPLAN',
      ownerUserId: 'user-1',
      nextBillingTime: null,
      lastPayment: null,
    });

    await reconcileSubscription('user-1');

    expect(store.subs[0]!.status).toBe('CANCELLED');
    expect(store.subs[0]!.autoRenew).toBe(false);
    // Το accessUntil δεν μειώθηκε από τον συγχρονισμό.
    expect(store.subs[0]!.accessUntil.getTime()).toBeLessThan(paidUntil.getTime());
  });
});
