import { describe, expect, it } from 'vitest';
import { billingActions } from '@/lib/billing/access';

describe('web billing actions', () => {
  it.each(['ACTIVE', 'GRACE'] as const)('blocks duplicate checkout and backend cancellation for %s store access', (kind) => {
    expect(billingActions({ kind, provider: 'REVENUECAT', autoRenew: true })).toEqual({
      canCheckout: false, canCancel: false, managedInStore: true,
    });
  });

  it('allows checkout after store access has expired', () => {
    expect(billingActions({ kind: 'LOCKED', provider: 'REVENUECAT', autoRenew: false }).canCheckout).toBe(true);
  });

  it.each(['STRIPE', 'PAYPAL'])('keeps cancellation for auto-renewing %s', (provider) => {
    expect(billingActions({ kind: 'ACTIVE', provider, autoRenew: true }).canCancel).toBe(true);
  });

  it('never offers unsupported manual cancellation', () => {
    expect(billingActions({ kind: 'ACTIVE', provider: 'MANUAL', autoRenew: true }).canCancel).toBe(false);
  });
});
