import 'server-only';
import { env, STRIPE_API_BASE, stripeConfigured } from '../env';

/** Σφάλμα παρόχου. Το `detail` μένει ΜΟΝΟ στα server logs, ποτέ στον client. */
export class StripeError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'StripeError';
    this.detail = detail;
  }
}

export interface StripeInvoice {
  id: string;
  amountPaidCents: number;
  paidAt: Date | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  ownerUserId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  latestInvoice: StripeInvoice | null;
}

export interface StripeCheckoutSession {
  id: string;
  clientReferenceId: string | null;
  complete: boolean;
  subscriptionId: string | null;
}

/** Το Stripe δέχεται form-encoded σώματα με ένθετα κλειδιά σε αγκύλες. */
function formEncode(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

async function call(
  path: string,
  init: { method: 'GET' | 'POST'; body?: Record<string, string | number | boolean> },
): Promise<unknown> {
  if (!stripeConfigured) {
    throw new StripeError('Stripe not configured', 'missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID');
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    ...(init.body ? { body: formEncode(init.body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new StripeError(
      'Stripe request failed',
      `path=${path} status=${response.status} body=${text.slice(0, 300)}`,
    );
  }
  return response.json();
}

function unixToDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
}

export async function createCheckoutSession(
  userId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ id: string; url: string }> {
  const data = (await call('/v1/checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'subscription',
      'line_items[0][price]': env.STRIPE_PRICE_ID,
      'line_items[0][quantity]': 1,
      // Δηλώνουμε ρητά κάρτα. Χωρίς αυτό το Stripe επιλέγει μόνο του μεθόδους
      // πληρωμής και απαντά 400 «No valid payment method types» όταν ο
      // λογαριασμός δεν έχει ενεργοποιημένη καμία συμβατή με το νόμισμα.
      'payment_method_types[0]': 'card',
      // Δύο ανεξάρτητοι σύνδεσμοι με τον λογαριασμό μας:
      // - client_reference_id: το διαβάζουμε στο return για επαλήθευση ιδιοκτησίας
      // - subscription metadata: επιβιώνει σε κάθε μελλοντική ανανέωση
      client_reference_id: userId,
      'subscription_data[metadata][userId]': userId,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      locale: 'en',
    },
  })) as { id: string; url?: string };

  if (!data.url) {
    throw new StripeError('Stripe request failed', 'checkout session has no url');
  }
  return { id: data.id, url: data.url };
}

export async function getCheckoutSession(id: string): Promise<StripeCheckoutSession> {
  const data = (await call(`/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    method: 'GET',
  })) as {
    id: string;
    client_reference_id?: string | null;
    status?: string;
    subscription?: string | { id: string } | null;
  };

  const subscription = data.subscription;
  return {
    id: data.id,
    clientReferenceId: data.client_reference_id ?? null,
    complete: data.status === 'complete',
    subscriptionId: typeof subscription === 'string' ? subscription : (subscription?.id ?? null),
  };
}

export async function getSubscription(id: string): Promise<StripeSubscription> {
  const data = (await call(`/v1/subscriptions/${encodeURIComponent(id)}?expand[]=latest_invoice`, {
    method: 'GET',
  })) as {
    id: string;
    status: string;
    cancel_at_period_end?: boolean;
    current_period_end?: number;
    metadata?: Record<string, string>;
    latest_invoice?: {
      id: string;
      amount_paid?: number;
      status_transitions?: { paid_at?: number };
    } | null;
  };

  const invoice = data.latest_invoice;
  return {
    id: data.id,
    status: data.status,
    ownerUserId: data.metadata?.userId ?? null,
    currentPeriodEnd: unixToDate(data.current_period_end),
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    latestInvoice: invoice
      ? {
          id: invoice.id,
          amountPaidCents: invoice.amount_paid ?? 0,
          paidAt: unixToDate(invoice.status_transitions?.paid_at),
        }
      : null,
  };
}

/**
 * Ακύρωση στο ΤΕΛΟΣ της περιόδου — όχι άμεση.
 * Ο χρήστης πλήρωσε τον μήνα· τον κρατά μέχρι να τελειώσει.
 */
export async function cancelAtPeriodEnd(id: string): Promise<void> {
  await call(`/v1/subscriptions/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: { cancel_at_period_end: true },
  });
}
