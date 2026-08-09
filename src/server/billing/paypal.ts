import 'server-only';
import { env, PAYPAL_API_BASE, paypalConfigured } from '../env';

/** Σφάλμα παρόχου. Το `detail` μένει ΜΟΝΟ στα server logs, ποτέ στον client. */
export class PayPalError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'PayPalError';
    this.detail = detail;
  }
}

export interface PayPalPayment {
  /** Συνθετικό αλλά σταθερό id: το PayPal δεν δίνει id στο last_payment. */
  externalId: string;
  amountCents: number;
  paidAt: Date | null;
}

export interface PayPalSubscription {
  id: string;
  status: string;
  planId: string | null;
  /** Το `custom_id` που στείλαμε κατά τη δημιουργία — ο δικός μας userId. */
  ownerUserId: string | null;
  nextBillingTime: Date | null;
  lastPayment: PayPalPayment | null;
}

/**
 * Το access token ζει ~9 ώρες. Το κρατάμε σε module scope: δεν είναι δεδομένο
 * χρήστη, είναι διαπιστευτήριο της εφαρμογής, οπότε η κοινή χρήση μεταξύ
 * αιτημάτων είναι σωστή και όχι διαρροή.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Ανανεώνουμε 60s νωρίτερα ώστε να μην πέσουμε σε λήξη εν πτήσει. */
const TOKEN_SAFETY_MS = 60_000;

async function getAccessToken(): Promise<string> {
  if (!paypalConfigured) {
    throw new PayPalError('PayPal not configured', 'missing PAYPAL_* environment variables');
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const basic = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString(
    'base64',
  );

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new PayPalError(
      'PayPal auth failed',
      `status=${response.status} body=${text.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new PayPalError('PayPal auth failed', 'response had no access_token');
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: now + Math.max(0, (data.expires_in ?? 0) * 1000 - TOKEN_SAFETY_MS),
  };
  return cachedToken.value;
}

async function call(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<unknown> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new PayPalError(
      'PayPal request failed',
      `path=${path} status=${response.status} body=${text.slice(0, 300)}`,
    );
  }

  // Το cancel επιστρέφει 204 χωρίς σώμα.
  if (response.status === 204) return null;
  return response.json();
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «12.34» -> 1234. Περνά από string ώστε να μην εισαχθεί σφάλμα float. */
function toCents(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

interface RawSubscription {
  id?: string;
  status?: string;
  plan_id?: string;
  custom_id?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: { value?: string }; time?: string };
  };
}

export async function getSubscription(subscriptionId: string): Promise<PayPalSubscription> {
  const data = (await call(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'GET',
  })) as RawSubscription;

  const lastPaymentRaw = data.billing_info?.last_payment;
  const paidAt = parseDate(lastPaymentRaw?.time);
  const amountCents = toCents(lastPaymentRaw?.amount?.value);

  return {
    id: data.id ?? subscriptionId,
    status: (data.status ?? 'UNKNOWN').toUpperCase(),
    planId: data.plan_id ?? null,
    ownerUserId: data.custom_id ?? null,
    nextBillingTime: parseDate(data.billing_info?.next_billing_time),
    lastPayment:
      amountCents > 0 && paidAt
        ? {
            // Το PayPal δεν δίνει id πληρωμής εδώ. Ο συνδυασμός συνδρομής και
            // χρονοσήμανσης είναι μοναδικός ανά χρέωση και σταθερός σε επόμενα
            // sync, οπότε το unique constraint κάνει σωστά το idempotency.
            externalId: `paypal:${data.id ?? subscriptionId}:${paidAt.toISOString()}`,
            amountCents,
            paidAt,
          }
        : null,
  };
}

/**
 * Ακύρωση. Το PayPal σταματά τις μελλοντικές χρεώσεις· η ήδη πληρωμένη
 * περίοδος δεν επιστρέφεται, οπότε το `accessUntil` μας παραμένει σωστό.
 */
export async function cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
  await call(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    body: { reason: reason.slice(0, 127) },
  });
}

/** Μόνο για tests: καθαρίζει το cache του token. */
export function __resetPayPalToken(): void {
  cachedToken = null;
}
