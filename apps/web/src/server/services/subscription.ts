import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import {
  env,
  paypalConfigured,
  paypalYearlyConfigured,
  stripeConfigured,
  stripeYearlyConfigured,
} from '../env';
import { ApiError } from '../errors';
import { logger } from '../logger';
import {
  cancelAtPeriodEnd,
  getCheckoutSession,
  getSubscription,
  type StripeSubscription,
} from '../billing/stripe';
import {
  cancelSubscription as cancelPayPalSubscription,
  getSubscription as getPayPalSubscription,
  type PayPalSubscription,
} from '../billing/paypal';
import {
  resolveAccessState,
  type AccessState,
  type SubscriptionSnapshot,
} from '@/lib/billing/access';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Σταθερά κώδικα (όχι ρύθμιση): μία ερώτηση στο Stripe ανά χρήστη ανά 5 λεπτά. */
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/** Καλείται ΜΕΣΑ στο transaction εγγραφής — χρήστης χωρίς συνδρομή δεν υπάρχει. */
export async function createTrialForUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.subscription.create({
    data: {
      userId,
      status: 'TRIALING',
      accessUntil: new Date(Date.now() + env.TRIAL_DAYS * DAY_MS),
    },
  });
}

async function loadInput(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  const snapshot: SubscriptionSnapshot | null = subscription
    ? {
        status: subscription.status,
        provider: subscription.provider,
        accessUntil: subscription.accessUntil,
        autoRenew: subscription.autoRenew,
      }
    : null;

  return {
    subscription,
    input: {
      role: user?.role ?? 'USER',
      billingEnabled: env.BILLING_ENABLED,
      graceDays: env.SUBSCRIPTION_GRACE_DAYS,
      subscription: snapshot,
    },
  };
}

/** Γρήγορος έλεγχος — καμία κλήση δικτύου όσο η πρόσβαση ισχύει. */
export async function getAccessState(userId: string): Promise<AccessState> {
  const { input } = await loadInput(userId);
  const state = resolveAccessState(input);
  if (state.canWrite && state.kind !== 'GRACE') return state;
  return reconcileSubscription(userId);
}

/**
 * Κοινή μορφή συνδρομής, ανεξάρτητη από πάροχο.
 *
 * Κάθε πάροχος μεταφράζεται σε ΑΥΤΟ, ώστε η λογική πρόσβασης να γράφεται μία
 * φορά. Προσθήκη τρίτου παρόχου σημαίνει μία συνάρτηση μετάφρασης και τίποτα
 * άλλο.
 */
interface RemoteSubscription {
  provider: 'STRIPE' | 'PAYPAL';
  /** Δίνει πρόσβαση αυτή τη στιγμή. */
  active: boolean;
  /** Δεν θα ανανεωθεί ξανά — αλλά η πληρωμένη περίοδος ισχύει. */
  cancelled: boolean;
  currentPeriodEnd: Date | null;
  payment: { externalId: string; amountCents: number; paidAt: Date | null } | null;
}

function fromStripe(remote: StripeSubscription): RemoteSubscription {
  const invoice = remote.latestInvoice;
  return {
    provider: 'STRIPE',
    active: remote.status === 'active' || remote.status === 'trialing',
    // cancel_at_period_end σημαίνει «πληρωμένος μέχρι τη λήξη, μετά τέλος»
    cancelled: remote.cancelAtPeriodEnd || remote.status === 'canceled',
    currentPeriodEnd: remote.currentPeriodEnd,
    payment:
      invoice && invoice.amountPaidCents > 0
        ? {
            // Το Stripe δίνει πραγματικό μοναδικό id τιμολογίου — το unique
            // constraint κάνει το idempotency χωρίς συνθετικό κλειδί.
            externalId: invoice.id,
            amountCents: invoice.amountPaidCents,
            paidAt: invoice.paidAt,
          }
        : null,
  };
}

function fromPayPal(remote: PayPalSubscription): RemoteSubscription {
  return {
    provider: 'PAYPAL',
    active: remote.status === 'ACTIVE',
    // Το PayPal ακυρώνει άμεσα· η ήδη πληρωμένη περίοδος δεν επιστρέφεται,
    // οπότε ο χρήστης διατηρεί πρόσβαση μέχρι το accessUntil που ήδη έχουμε.
    cancelled: remote.status === 'CANCELLED' || remote.status === 'SUSPENDED',
    currentPeriodEnd: remote.nextBillingTime,
    payment: remote.lastPayment,
  };
}

async function recordPaymentIfNew(userId: string, remote: RemoteSubscription): Promise<void> {
  const payment = remote.payment;
  if (!payment || payment.amountCents <= 0) return;
  try {
    await prisma.payment.create({
      data: {
        userId,
        provider: remote.provider,
        externalId: payment.externalId,
        amountCents: payment.amountCents,
        paidAt: payment.paidAt ?? new Date(),
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== 'P2002') throw error;
  }
}

async function applyRemote(userId: string, remote: RemoteSubscription): Promise<void> {
  if (remote.active) {
    await prisma.subscription.update({
      where: { userId },
      data: {
        status: remote.cancelled ? 'CANCELLED' : 'ACTIVE',
        provider: remote.provider,
        accessUntil: remote.currentPeriodEnd ?? addMonths(new Date(), 1),
        autoRenew: !remote.cancelled,
        cancelledAt: remote.cancelled ? new Date() : null,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
    await recordPaymentIfNew(userId, remote);
    return;
  }

  // Ανενεργή συνδρομή: το `accessUntil` ΔΕΝ μειώνεται ποτέ εδώ — ο χρήστης
  // έχει πληρώσει για την τρέχουσα περίοδο και τη δικαιούται ολόκληρη.
  await prisma.subscription.update({
    where: { userId },
    data: {
      status: remote.cancelled ? 'CANCELLED' : 'EXPIRED',
      autoRenew: false,
      lastSyncedAt: new Date(),
      lastSyncError: null,
    },
  });
  await recordPaymentIfNew(userId, remote);
}

/**
 * Η μοναδική συνάρτηση που συγχρονίζει με τον πάροχο.
 * Όταν υπάρξει δημόσιο URL, το webhook route θα καλεί ΑΥΤΗΝ — τίποτα άλλο δεν αλλάζει.
 */
export async function reconcileSubscription(userId: string): Promise<AccessState> {
  const { subscription, input } = await loadInput(userId);
  const current = resolveAccessState(input);

  if (current.kind === 'UNLIMITED') return current;
  if (!subscription) return current;
  if (!subscription.externalId) return current;
  // MANUAL (IRIS/IBAN) δεν έχει πάροχο να ρωτήσουμε.
  if (subscription.provider !== 'STRIPE' && subscription.provider !== 'PAYPAL') return current;
  if (subscription.accessUntil.getTime() > Date.now()) return current;

  const lastSynced = subscription.lastSyncedAt?.getTime() ?? 0;
  if (Date.now() - lastSynced < SYNC_COOLDOWN_MS) return current;

  try {
    const remote =
      subscription.provider === 'PAYPAL'
        ? fromPayPal(await getPayPalSubscription(subscription.externalId))
        : fromStripe(await getSubscription(subscription.externalId));
    await applyRemote(userId, remote);
  } catch (error) {
    // ΔΕΝ αλλάζουμε το accessUntil: ο χρήστης δεν φταίει για σφάλμα δικτύου.
    // Η περίοδος χάριτος στο resolveAccessState τον καλύπτει.
    logger.error('subscription_sync_failed', {
      userId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    await prisma.subscription.update({
      where: { userId },
      data: { lastSyncError: 'SYNC_FAILED', lastSyncedAt: new Date() },
    });
  }

  const refreshed = await loadInput(userId);
  return resolveAccessState(refreshed.input);
}

/** Καλείται στο success URL. Επαληθεύει ΙΔΙΟΚΤΗΣΙΑ πριν ενεργοποιήσει. */
export async function attachStripeCheckout(userId: string, sessionId: string): Promise<void> {
  const session = await getCheckoutSession(sessionId);

  if (session.clientReferenceId !== userId) {
    logger.warn('stripe_session_owner_mismatch', { userId });
    throw new ApiError('FORBIDDEN', 'Η πληρωμή δεν αντιστοιχεί σε αυτόν τον λογαριασμό.');
  }
  if (!session.complete || !session.subscriptionId) {
    throw new ApiError('BAD_REQUEST', 'Η πληρωμή δεν ολοκληρώθηκε ακόμη. Δοκίμασε ξανά σε λίγο.');
  }

  const remote = await getSubscription(session.subscriptionId);
  await prisma.subscription.update({
    where: { userId },
    data: { provider: 'STRIPE', externalId: session.subscriptionId },
  });
  await applyRemote(userId, fromStripe(remote));
  logger.info('subscription_activated', { userId, provider: 'STRIPE' });
}

/**
 * Καλείται από το `onApprove` του PayPal button.
 *
 * ΚΡΙΣΙΜΟ: το subscription id έρχεται από τον browser και είναι εντελώς
 * αναξιόπιστο. Χωρίς τους παρακάτω ελέγχους οποιοσδήποτε θα μπορούσε να
 * στείλει ένα ξένο (ή φανταστικό) id και να ξεκλειδώσει τον λογαριασμό του.
 */
export async function attachPayPalSubscription(
  userId: string,
  subscriptionId: string,
): Promise<void> {
  const remote = await getPayPalSubscription(subscriptionId);

  // 1. Η συνδρομή πρέπει να αφορά ΤΟ δικό μας πλάνο.
  const allowedPayPalPlanIds = [
    env.PAYPAL_PLAN_ID,
    env.PAYPAL_YEARLY_PLAN_ID,
    env.PAYPAL_COUPON_PLAN_ID,
  ].filter(Boolean);
  if (!remote.planId || !allowedPayPalPlanIds.includes(remote.planId)) {
    logger.warn('paypal_plan_mismatch', { userId, planId: remote.planId });
    throw new ApiError('FORBIDDEN', 'Η συνδρομή δεν αντιστοιχεί σε αυτή την υπηρεσία.');
  }

  // 2. Το custom_id που στείλαμε κατά τη δημιουργία πρέπει να είναι ο χρήστης.
  if (remote.ownerUserId !== userId) {
    logger.warn('paypal_owner_mismatch', { userId });
    throw new ApiError('FORBIDDEN', 'Η πληρωμή δεν αντιστοιχεί σε αυτόν τον λογαριασμό.');
  }

  // 3. Η ίδια συνδρομή δεν μπορεί να χρησιμοποιηθεί σε δεύτερο λογαριασμό.
  const claimed = await prisma.subscription.findUnique({
    where: { externalId: subscriptionId },
    select: { userId: true },
  });
  if (claimed && claimed.userId !== userId) {
    logger.warn('paypal_subscription_already_claimed', { userId });
    throw new ApiError('FORBIDDEN', 'Η συνδρομή χρησιμοποιείται ήδη σε άλλον λογαριασμό.');
  }

  // 4. Πρέπει όντως να είναι ενεργή στο PayPal.
  if (remote.status !== 'ACTIVE') {
    throw new ApiError(
      'BAD_REQUEST',
      'Η συνδρομή δεν είναι ακόμη ενεργή. Δοκίμασε ξανά σε λίγο.',
    );
  }

  await prisma.subscription.update({
    where: { userId },
    data: { provider: 'PAYPAL', externalId: subscriptionId },
  });
  await applyRemote(userId, fromPayPal(remote));
  logger.info('subscription_activated', { userId, provider: 'PAYPAL' });
}

export async function cancelUserSubscription(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (
    !subscription?.externalId ||
    (subscription.provider !== 'STRIPE' && subscription.provider !== 'PAYPAL')
  ) {
    throw new ApiError('BAD_REQUEST', 'Δεν υπάρχει ενεργή συνδρομή προς ακύρωση.');
  }

  if (subscription.provider === 'PAYPAL') {
    await cancelPayPalSubscription(subscription.externalId, 'Cancelled by user in NutreLuma');
  } else {
    await cancelAtPeriodEnd(subscription.externalId);
  }

  // Το accessUntil ΔΕΝ αλλάζει: ο πληρωμένος μήνας ολοκληρώνεται.
  await prisma.subscription.update({
    where: { userId },
    data: { status: 'CANCELLED', autoRenew: false, cancelledAt: new Date() },
  });
  logger.info('subscription_cancelled', { userId, provider: subscription.provider });
}

export async function extendManually(
  userId: string,
  months: number,
  note: string,
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) throw new ApiError('NOT_FOUND', 'Ο χρήστης δεν βρέθηκε.');

  const now = new Date();
  // max(): πρόωρη πληρωμή ΠΡΟΣΘΕΤΕΙ χρόνο αντί να τον χάνει.
  const from = subscription.accessUntil.getTime() > now.getTime() ? subscription.accessUntil : now;

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: 'ACTIVE',
      provider: 'MANUAL',
      accessUntil: addMonths(from, months),
      autoRenew: false,
    },
  });
  await prisma.payment.create({
    data: {
      userId,
      provider: 'MANUAL',
      amountCents: months * env.SUBSCRIPTION_PRICE_CENTS,
      paidAt: now,
      note: note.slice(0, 300),
    },
  });
  logger.info('subscription_extended_manually', { userId, months });
}

export interface BillingOverview {
  state: AccessState;
  status: string;
  provider: string | null;
  priceCents: number;
  originalPriceCents: number;
  discountPercent: number;
  couponPriceCents: number;
  couponDiscountPercent: number;
  paypalCouponPlanId: string | null;
  yearlyPriceCents: number;
  yearlyOriginalPriceCents: number;
  yearlyDiscountPercent: number;
  stripeYearlyAvailable: boolean;
  paypalYearlyAvailable: boolean;
  paypalYearlyPlanId: string | null;
  stripeAvailable: boolean;
  paypalAvailable: boolean;
  /** Δημόσιο εκ σχεδιασμού: μπαίνει στο JS SDK του browser. */
  paypalClientId: string | null;
  paypalPlanId: string | null;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    paidAt: string;
    note: string | null;
  }>;
}

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const state = await getAccessState(userId);
  const [subscription, payments] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.payment.findMany({ where: { userId }, orderBy: { paidAt: 'desc' }, take: 24 }),
  ]);

  return {
    state,
    status: subscription?.status ?? 'EXPIRED',
    provider: subscription?.provider ?? null,
    priceCents: env.SUBSCRIPTION_PRICE_CENTS,
    originalPriceCents: env.SUBSCRIPTION_ORIGINAL_PRICE_CENTS,
    discountPercent: env.SUBSCRIPTION_DISCOUNT_PERCENT,
    couponPriceCents: env.SUBSCRIPTION_COUPON_PRICE_CENTS,
    couponDiscountPercent: 50,
    paypalCouponPlanId: env.PAYPAL_COUPON_PLAN_ID || null,
    yearlyPriceCents: env.SUBSCRIPTION_YEARLY_PRICE_CENTS,
    yearlyOriginalPriceCents: env.SUBSCRIPTION_YEARLY_ORIGINAL_PRICE_CENTS,
    yearlyDiscountPercent: Math.max(
      0,
      Math.round(
        100 -
          (env.SUBSCRIPTION_YEARLY_PRICE_CENTS / env.SUBSCRIPTION_YEARLY_ORIGINAL_PRICE_CENTS) *
            100,
      ),
    ),
    stripeYearlyAvailable: stripeYearlyConfigured,
    paypalYearlyAvailable: paypalYearlyConfigured,
    paypalYearlyPlanId: paypalYearlyConfigured ? env.PAYPAL_YEARLY_PLAN_ID : null,
    stripeAvailable: stripeConfigured,
    paypalAvailable: paypalConfigured,
    paypalClientId: paypalConfigured || paypalYearlyConfigured ? env.PAYPAL_CLIENT_ID : null,
    paypalPlanId: paypalConfigured ? env.PAYPAL_PLAN_ID : null,
    payments: payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
      paidAt: payment.paidAt.toISOString(),
      note: payment.note,
    })),
  };
}
