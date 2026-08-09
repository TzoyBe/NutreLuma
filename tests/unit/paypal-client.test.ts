import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.PAYPAL_CLIENT_ID = 'client-id-test';
process.env.PAYPAL_CLIENT_SECRET = 'client-secret-test';
process.env.PAYPAL_PLAN_ID = 'P-TESTPLAN';
process.env.PAYPAL_ENV = 'sandbox';

const { getSubscription, cancelSubscription, PayPalError, __resetPayPalToken } = await import(
  '@/server/billing/paypal'
);

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tokenResponse = () => ok({ access_token: 'tok_123', expires_in: 32400 });

beforeEach(() => __resetPayPalToken());
afterEach(() => vi.unstubAllGlobals());

describe('αυθεντικοποίηση', () => {
  it('ζητά token με Basic auth και το επαναχρησιμοποιεί', async () => {
    // Νέο Response ανά κλήση: το σώμα ενός Response διαβάζεται μόνο μία φορά.
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => tokenResponse())
      .mockImplementation(async () => ok({ id: 'I-1', status: 'ACTIVE' }));
    vi.stubGlobal('fetch', fetchMock);

    await getSubscription('I-1');
    await getSubscription('I-1');

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(tokenUrl).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(tokenInit.headers.authorization).toBe(
      `Basic ${Buffer.from('client-id-test:client-secret-test').toString('base64')}`,
    );
    expect(tokenInit.body).toBe('grant_type=client_credentials');

    // 1 token + 2 κλήσεις συνδρομής: το token δεν ξαναζητήθηκε.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('πετάει PayPalError όταν αποτύχει το token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ error: 'invalid_client' }, 401)));
    await expect(getSubscription('I-1')).rejects.toBeInstanceOf(PayPalError);
  });
});

describe('getSubscription', () => {
  function withSubscription(body: unknown) {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => tokenResponse())
      .mockImplementation(async () => ok(body));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('χαρτογραφεί ενεργή συνδρομή με πληρωμή', async () => {
    withSubscription({
      id: 'I-ABC',
      status: 'ACTIVE',
      plan_id: 'P-TESTPLAN',
      custom_id: 'user-7',
      billing_info: {
        next_billing_time: '2026-09-06T10:00:00Z',
        last_payment: { amount: { value: '3.00' }, time: '2026-08-06T10:00:00Z' },
      },
    });

    const result = await getSubscription('I-ABC');
    expect(result.status).toBe('ACTIVE');
    expect(result.planId).toBe('P-TESTPLAN');
    expect(result.ownerUserId).toBe('user-7');
    expect(result.nextBillingTime?.toISOString()).toBe('2026-09-06T10:00:00.000Z');
    expect(result.lastPayment?.amountCents).toBe(300);
    // Συνθετικό αλλά ντετερμινιστικό id -> idempotent καταγραφή πληρωμής.
    expect(result.lastPayment?.externalId).toBe('paypal:I-ABC:2026-08-06T10:00:00.000Z');
  });

  it('μετατρέπει ποσά χωρίς σφάλμα κινητής υποδιαστολής', async () => {
    withSubscription({
      id: 'I-C',
      status: 'ACTIVE',
      billing_info: { last_payment: { amount: { value: '19.99' }, time: '2026-08-06T10:00:00Z' } },
    });
    expect((await getSubscription('I-C')).lastPayment?.amountCents).toBe(1999);
  });

  it('αγνοεί μη έγκυρο ποσό αντί να το περάσει ως μηδέν', async () => {
    withSubscription({
      id: 'I-D',
      status: 'ACTIVE',
      billing_info: { last_payment: { amount: { value: 'abc' }, time: '2026-08-06T10:00:00Z' } },
    });
    expect((await getSubscription('I-D')).lastPayment).toBeNull();
  });

  it('χειρίζεται συνδρομή χωρίς πληρωμή ή ημερομηνία', async () => {
    withSubscription({ id: 'I-E', status: 'APPROVAL_PENDING' });
    const result = await getSubscription('I-E');
    expect(result.lastPayment).toBeNull();
    expect(result.nextBillingTime).toBeNull();
    expect(result.ownerUserId).toBeNull();
  });

  it('κάνει escape το id στο URL', async () => {
    const fetchMock = withSubscription({ id: 'x', status: 'ACTIVE' });
    await getSubscription('I-../../etc');
    const [url] = fetchMock.mock.calls[1]!;
    expect(url).toContain('I-..%2F..%2Fetc');
  });
});

describe('cancelSubscription', () => {
  it('στέλνει POST με αιτιολογία και δέχεται 204 χωρίς σώμα', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => tokenResponse())
      .mockImplementation(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(cancelSubscription('I-ABC', 'user requested')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('https://api-m.sandbox.paypal.com/v1/billing/subscriptions/I-ABC/cancel');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'user requested' });
  });
});
