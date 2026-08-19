/**
 * Καθαρή λογική πρόσβασης — χωρίς βάση, χωρίς δίκτυο, χωρίς `now()`.
 * Ο χρόνος περνά ως παράμετρος ώστε η συμπεριφορά να είναι ντετερμινιστική
 * και να δοκιμάζεται εξαντλητικά.
 *
 * Αυτή η συνάρτηση αποφασίζει αν κάποιος πληρώνει ή όχι. Ένα λάθος εδώ είτε
 * δίνει τζάμπα πρόσβαση είτε κλειδώνει πληρωμένο πελάτη — γι' αυτό δεν κάνει
 * τίποτα άλλο πέρα από συγκρίσεις ημερομηνιών.
 */

export type AccessStateKind = 'UNLIMITED' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'LOCKED';

export interface SubscriptionSnapshot {
  status: 'TRIALING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  provider: 'STRIPE' | 'PAYPAL' | 'MANUAL' | null;
  accessUntil: Date;
  autoRenew: boolean;
}

export interface AccessInput {
  role: string;
  billingEnabled: boolean;
  graceDays: number;
  subscription: SubscriptionSnapshot | null;
}

export interface AccessState {
  kind: AccessStateKind;
  canWrite: boolean;
  accessUntil: Date | null;
  daysRemaining: number | null;
  autoRenew: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

export function resolveAccessState(input: AccessInput, now: Date = new Date()): AccessState {
  const unlimited: AccessState = {
    kind: 'UNLIMITED',
    canWrite: true,
    accessUntil: null,
    daysRemaining: null,
    autoRenew: false,
  };

  if (input.role === 'ADMIN' || !input.billingEnabled) return unlimited;

  const sub = input.subscription;
  if (!sub) {
    return {
      kind: 'LOCKED',
      canWrite: false,
      accessUntil: null,
      daysRemaining: null,
      autoRenew: false,
    };
  }

  if (sub.accessUntil.getTime() > now.getTime()) {
    return {
      kind: sub.status === 'TRIALING' ? 'TRIAL' : 'ACTIVE',
      canWrite: true,
      accessUntil: sub.accessUntil,
      daysRemaining: Math.max(0, daysBetween(now, sub.accessUntil)),
      autoRenew: sub.autoRenew,
    };
  }

  // Χάρη ΜΟΝΟ όταν αναμένεται αυτόματη ανανέωση που μπορεί να καθυστερεί.
  // Δεν τη δικαιούνται:
  //   TRIALING  — η δοκιμή λήγει οριστικά, δεν υπάρχει πάροχος να ρωτήσουμε
  //   CANCELLED — ο χρήστης ακύρωσε συνειδητά, δεν αναμένεται ανανέωση
  //   MANUAL    — δεν υπάρχει αυτόματη χρέωση που θα μπορούσε να καθυστερήσει
  const automaticProvider = sub.provider === 'STRIPE' || sub.provider === 'PAYPAL';
  const eligibleForGrace = sub.status === 'ACTIVE' && sub.autoRenew && automaticProvider;
  const graceEnds = new Date(sub.accessUntil.getTime() + input.graceDays * DAY_MS);

  if (eligibleForGrace && graceEnds.getTime() > now.getTime()) {
    return {
      kind: 'GRACE',
      canWrite: true,
      accessUntil: sub.accessUntil,
      daysRemaining: 0,
      autoRenew: sub.autoRenew,
    };
  }

  return {
    kind: 'LOCKED',
    canWrite: false,
    accessUntil: sub.accessUntil,
    daysRemaining: 0,
    autoRenew: sub.autoRenew,
  };
}
