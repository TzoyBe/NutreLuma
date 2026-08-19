import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_PRICE_ID = 'price_123';

const {
  createCheckoutSession,
  getCheckoutSession,
  getSubscription,
  cancelAtPeriodEnd,
  StripeError,
} = await import('@/server/billing/stripe');

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('createCheckoutSession', () => {
  it('στέλνει form-encoded σώμα με client_reference_id και επιστρέφει URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'cs_1', url: 'https://checkout/x' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createCheckoutSession('user-7', 'https://app/ok', 'https://app/no');
    expect(result).toEqual({ id: 'cs_1', url: 'https://checkout/x' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(init.headers.authorization).toBe('Bearer sk_test_dummy');
    expect(init.headers['content-type']).toBe('application/x-www-form-urlencoded');

    const body = new URLSearchParams(init.body as string);
    expect(body.get('mode')).toBe('subscription');
    expect(body.get('client_reference_id')).toBe('user-7');
    expect(body.get('line_items[0][price]')).toBe('price_123');
    expect(body.get('subscription_data[metadata][userId]')).toBe('user-7');
    // Χωρίς ρητή μέθοδο πληρωμής το Stripe απαντά 400 όταν ο λογαριασμός
    // δεν έχει ενεργοποιημένη καμία συμβατή με το νόμισμα της τιμής.
    expect(body.get('payment_method_types[0]')).toBe('card');
  });

  it('πετάει StripeError σε σφάλμα', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ error: { message: 'nope' } }, 400)));
    await expect(createCheckoutSession('u', 'a', 'b')).rejects.toBeInstanceOf(StripeError);
  });
});

describe('getCheckoutSession', () => {
  it('χαρτογραφεί ολοκληρωμένη συνεδρία', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({
          id: 'cs_1',
          client_reference_id: 'user-7',
          status: 'complete',
          subscription: 'sub_123',
        }),
      ),
    );
    const session = await getCheckoutSession('cs_1');
    expect(session.clientReferenceId).toBe('user-7');
    expect(session.complete).toBe(true);
    expect(session.subscriptionId).toBe('sub_123');
  });

  it('δέχεται subscription ως αντικείμενο (expanded)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({ id: 'cs_1', client_reference_id: 'u', status: 'open', subscription: { id: 'sub_9' } }),
      ),
    );
    const session = await getCheckoutSession('cs_1');
    expect(session.subscriptionId).toBe('sub_9');
    expect(session.complete).toBe(false);
  });
});

describe('getSubscription', () => {
  it('χαρτογραφεί ενεργή συνδρομή με τιμολόγιο', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({
          id: 'sub_1',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: 1788000000,
          metadata: { userId: 'user-7' },
          latest_invoice: {
            id: 'in_42',
            amount_paid: 300,
            status_transitions: { paid_at: 1785400000 },
          },
        }),
      ),
    );

    const sub = await getSubscription('sub_1');
    expect(sub.status).toBe('active');
    expect(sub.ownerUserId).toBe('user-7');
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.currentPeriodEnd?.getTime()).toBe(1788000000 * 1000);
    expect(sub.latestInvoice).toEqual({
      id: 'in_42',
      amountPaidCents: 300,
      paidAt: new Date(1785400000 * 1000),
    });
  });

  it('ανέχεται συνδρομή χωρίς τιμολόγιο ή period end', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          ok({ id: 'sub_1', status: 'canceled', cancel_at_period_end: true, metadata: {} }),
        ),
    );
    const sub = await getSubscription('sub_1');
    expect(sub.currentPeriodEnd).toBeNull();
    expect(sub.latestInvoice).toBeNull();
    expect(sub.ownerUserId).toBeNull();
  });
});

describe('cancelAtPeriodEnd', () => {
  it('στέλνει cancel_at_period_end=true ώστε να μη χαθεί ο πληρωμένος χρόνος', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 'sub_1', cancel_at_period_end: true }));
    vi.stubGlobal('fetch', fetchMock);

    await cancelAtPeriodEnd('sub_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(new URLSearchParams(init.body as string).get('cancel_at_period_end')).toBe('true');
  });
});
