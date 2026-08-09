import { describe, expect, it } from 'vitest';
import { resolveAccessState, type AccessInput } from '@/lib/billing/access';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const base: AccessInput = {
  role: 'USER',
  billingEnabled: true,
  graceDays: 3,
  subscription: {
    status: 'TRIALING',
    provider: null,
    accessUntil: days(2),
    autoRenew: false,
  },
};

describe('resolveAccessState', () => {
  it('ο ADMIN έχει πάντα πρόσβαση χωρίς συνδρομή', () => {
    const state = resolveAccessState({ ...base, role: 'ADMIN', subscription: null }, NOW);
    expect(state.kind).toBe('UNLIMITED');
    expect(state.canWrite).toBe(true);
  });

  it('με BILLING_ENABLED=false όλοι γράφουν', () => {
    const state = resolveAccessState({ ...base, billingEnabled: false, subscription: null }, NOW);
    expect(state.kind).toBe('UNLIMITED');
    expect(state.canWrite).toBe(true);
  });

  it('χρήστης χωρίς συνδρομή είναι κλειδωμένος', () => {
    const state = resolveAccessState({ ...base, subscription: null }, NOW);
    expect(state.kind).toBe('LOCKED');
    expect(state.canWrite).toBe(false);
  });

  it('ενεργή δοκιμή επιτρέπει εγγραφή και μετρά ημέρες', () => {
    const state = resolveAccessState(base, NOW);
    expect(state.kind).toBe('TRIAL');
    expect(state.canWrite).toBe(true);
    expect(state.daysRemaining).toBe(2);
  });

  it('ληγμένη δοκιμή ΔΕΝ παίρνει χάρη', () => {
    const state = resolveAccessState(
      { ...base, subscription: { ...base.subscription!, accessUntil: days(-1) } },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
    expect(state.canWrite).toBe(false);
  });

  it('ενεργή συνδρομή επιτρέπει εγγραφή', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'STRIPE',
          accessUntil: days(20),
          autoRenew: true,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('ACTIVE');
    expect(state.canWrite).toBe(true);
    expect(state.autoRenew).toBe(true);
  });

  it('ληγμένη ενεργή συνδρομή με autoRenew παίρνει χάρη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'STRIPE',
          accessUntil: days(-1),
          autoRenew: true,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('GRACE');
    expect(state.canWrite).toBe(true);
  });

  it('μετά το τέλος της χάριτος κλειδώνει', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'STRIPE',
          accessUntil: days(-4),
          autoRenew: true,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
    expect(state.canWrite).toBe(false);
  });

  it('ακυρωμένη συνδρομή ΔΕΝ παίρνει χάρη μετά τη λήξη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'CANCELLED',
          provider: 'STRIPE',
          accessUntil: days(-1),
          autoRenew: false,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
  });

  it('ακυρωμένη συνδρομή διατηρεί πρόσβαση μέχρι τη λήξη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'CANCELLED',
          provider: 'STRIPE',
          accessUntil: days(10),
          autoRenew: false,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('ACTIVE');
    expect(state.canWrite).toBe(true);
  });

  it('χειροκίνητη συνδρομή ΔΕΝ παίρνει χάρη', () => {
    const state = resolveAccessState(
      {
        ...base,
        subscription: {
          status: 'ACTIVE',
          provider: 'MANUAL',
          accessUntil: days(-1),
          autoRenew: false,
        },
      },
      NOW,
    );
    expect(state.kind).toBe('LOCKED');
  });
});
