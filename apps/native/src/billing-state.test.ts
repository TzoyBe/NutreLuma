import { describe, expect, test } from 'vitest';
import { billingAccessView } from './billing-state';

describe('billingAccessView', () => {
  test.each([
    {
      name: 'an active Stripe subscription managed on the web',
      billing: { state: { kind: 'ACTIVE', canWrite: true }, provider: 'STRIPE' },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: true, canPurchase: false },
    },
    {
      name: 'an active PayPal subscription managed on the web',
      billing: { state: { kind: 'ACTIVE', canWrite: true }, provider: 'PAYPAL' },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: true, canPurchase: false },
    },
    {
      name: 'manual access',
      billing: { state: { kind: 'UNLIMITED', canWrite: true }, provider: 'MANUAL' },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false },
    },
    {
      name: 'an active RevenueCat subscription',
      billing: { state: { kind: 'ACTIVE', canWrite: true }, provider: 'REVENUECAT' },
      revenueCatIsPro: true,
      expected: { active: true, managedByRevenueCat: true, managedOnWeb: false, canPurchase: false },
    },
    {
      name: 'a server-authorized trial',
      billing: { state: { kind: 'TRIAL', canWrite: true }, provider: null },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false },
    },
    {
      name: 'a locked account even when RevenueCat has stale local access',
      billing: { state: { kind: 'LOCKED', canWrite: false }, provider: null },
      revenueCatIsPro: true,
      expected: { active: false, managedByRevenueCat: false, managedOnWeb: false, canPurchase: true },
    },
    {
      name: 'a local RevenueCat purchase awaiting backend synchronization',
      billing: null,
      revenueCatIsPro: true,
      expected: { active: true, managedByRevenueCat: true, managedOnWeb: false, canPurchase: false },
    },
  ])('$name', ({ billing, revenueCatIsPro, expected }) => {
    expect(billingAccessView(billing, revenueCatIsPro)).toEqual(expected);
  });
});
