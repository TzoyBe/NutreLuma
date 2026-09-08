import 'server-only';
import { z } from 'zod';
import {
  env,
  REVENUECAT_API_BASE,
  revenueCatConfigured,
  revenueCatProductIds,
} from '../env';

const nullableDateString = z.string().nullable().optional();

const revenueCatResponseSchema = z.object({
  subscriber: z.object({
    entitlements: z.record(
      z.object({
        product_identifier: z.string().min(1),
        // RevenueCat uses null for lifetime entitlements; an omitted field is malformed.
        expires_date: z.string().nullable(),
      }),
    ),
    subscriptions: z.record(
      z.object({
        expires_date: nullableDateString,
        grace_period_expires_date: nullableDateString,
        store: z.string(),
        store_transaction_id: z.union([z.string(), z.number()]).nullable().optional(),
        purchase_date: nullableDateString,
        unsubscribe_detected_at: nullableDateString,
        refunded_at: nullableDateString,
        is_sandbox: z.boolean(),
      }),
    ),
  }),
});

export class RevenueCatError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'RevenueCatError';
    this.detail = detail;
  }
}

export interface RevenueCatSubscription {
  appUserId: string;
  active: boolean;
  cancelled: boolean;
  accessUntil: Date | null;
  productId: string | null;
  store: 'app_store' | 'play_store' | null;
  transactionId: string | null;
  purchasedAt: Date | null;
}

function parseDate(value: string | null | undefined, field: string): Date | null {
  if (value == null) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RevenueCatError('RevenueCat response invalid', `malformed ${field}`);
  }
  return date;
}

function latestDate(...dates: Array<Date | null>): Date | null {
  return dates.reduce<Date | null>(
    (latest, date) => (date && (!latest || date > latest) ? date : latest),
    null,
  );
}

async function fetchSubscriber(appUserId: string): Promise<unknown> {
  if (!revenueCatConfigured) {
    throw new RevenueCatError('RevenueCat not configured', 'missing RevenueCat server configuration');
  }

  let response: Response;
  try {
    response = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'unknown fetch failure';
    throw new RevenueCatError('RevenueCat request failed', detail);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new RevenueCatError(
      'RevenueCat request failed',
      `status=${response.status} body=${body.slice(0, 300)}`,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'invalid response body';
    throw new RevenueCatError('RevenueCat response invalid', detail);
  }
}

export async function getRevenueCatSubscription(
  appUserId: string,
): Promise<RevenueCatSubscription> {
  const raw = await fetchSubscriber(appUserId);
  const parsed = revenueCatResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RevenueCatError('RevenueCat response invalid', 'unexpected subscriber response shape');
  }

  const entitlement = parsed.data.subscriber.entitlements[env.REVENUECAT_ENTITLEMENT_ID];
  if (!entitlement) {
    throw new RevenueCatError('RevenueCat response invalid', 'configured entitlement is missing');
  }

  const productId = entitlement.product_identifier;
  if (!revenueCatProductIds.includes(productId)) {
    throw new RevenueCatError('RevenueCat response invalid', 'entitlement product is not allow-listed');
  }

  const subscription = parsed.data.subscriber.subscriptions[productId];
  if (!subscription) {
    throw new RevenueCatError('RevenueCat response invalid', 'entitlement subscription is missing');
  }

  if (subscription.store !== 'app_store' && subscription.store !== 'play_store') {
    throw new RevenueCatError('RevenueCat response invalid', 'entitlement store is not supported');
  }
  if (subscription.is_sandbox && !env.REVENUECAT_ALLOW_SANDBOX) {
    throw new RevenueCatError('RevenueCat response invalid', 'sandbox purchase is not allowed');
  }

  const entitlementExpiresAt = parseDate(entitlement.expires_date, 'entitlement expires_date');
  parseDate(subscription.expires_date, 'subscription expires_date');
  const gracePeriodExpiresAt = parseDate(
    subscription.grace_period_expires_date,
    'grace_period_expires_date',
  );
  const accessUntil = latestDate(entitlementExpiresAt, gracePeriodExpiresAt);
  const unsubscribedAt = parseDate(subscription.unsubscribe_detected_at, 'unsubscribe_detected_at');
  const refundedAt = parseDate(subscription.refunded_at, 'refunded_at');

  return {
    appUserId,
    active: accessUntil === null || accessUntil > new Date(),
    cancelled: unsubscribedAt !== null || refundedAt !== null,
    accessUntil,
    productId,
    store: subscription.store,
    transactionId:
      subscription.store_transaction_id == null ? null : String(subscription.store_transaction_id),
    purchasedAt: parseDate(subscription.purchase_date, 'purchase_date'),
  };
}
