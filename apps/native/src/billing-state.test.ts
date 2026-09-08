import { describe, expect, test } from 'vitest';
import { billingAccessView } from './billing-state';

describe('billingAccessView', () => {
  test.each([
    {
      name: 'an active Stripe subscription managed on the web',
      billing: { state: { kind: 'ACTIVE', canWrite: true }, provider: 'STRIPE' },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: true, canPurchase: false, needsVerification: false },
    },
    {
      name: 'an active PayPal subscription managed on the web',
      billing: { state: { kind: 'ACTIVE', canWrite: true }, provider: 'PAYPAL' },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: true, canPurchase: false, needsVerification: false },
    },
    {
      name: 'manual access',
      billing: { state: { kind: 'UNLIMITED', canWrite: true }, provider: 'MANUAL' },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false, needsVerification: false },
    },
    {
      name: 'an active RevenueCat subscription',
      billing: { state: { kind: 'ACTIVE', canWrite: true }, provider: 'REVENUECAT' },
      revenueCatIsPro: true,
      expected: { active: true, managedByRevenueCat: true, managedOnWeb: false, canPurchase: false, needsVerification: false },
    },
    {
      name: 'a server-authorized trial',
      billing: { state: { kind: 'TRIAL', canWrite: true }, provider: null },
      revenueCatIsPro: false,
      expected: { active: true, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false, needsVerification: false },
    },
    {
      name: 'a locked account even when RevenueCat has stale local access',
      billing: { state: { kind: 'LOCKED', canWrite: false }, provider: null },
      revenueCatIsPro: true,
      expected: { active: false, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false, needsVerification: true },
    },
    {
      name: 'an initial billing load failure without local RevenueCat access',
      billing: null,
      revenueCatIsPro: false,
      expected: { active: false, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false, needsVerification: false },
    },
    {
      name: 'a local RevenueCat entitlement awaiting backend verification',
      billing: null,
      revenueCatIsPro: true,
      expected: { active: false, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false, needsVerification: true },
    },
    {
      name: 'a pending store transaction with unavailable local CustomerInfo',
      billing: null,
      revenueCatIsPro: false,
      pendingRevenueCatVerification: true,
      expected: { active: false, managedByRevenueCat: false, managedOnWeb: false, canPurchase: false, needsVerification: true },
    },
    {
      name: 'a pending store transaction with a locked backend record',
      billing: { state: { kind: 'LOCKED', canWrite: false }, provider: 'REVENUECAT' },
      revenueCatIsPro: false,
      pendingRevenueCatVerification: true,
      expected: { active: false, managedByRevenueCat: true, managedOnWeb: false, canPurchase: false, needsVerification: true },
    },
    {
      name: 'an expired RevenueCat backend record with a local entitlement',
      billing: { state: { kind: 'LOCKED', canWrite: false }, provider: 'REVENUECAT' },
      revenueCatIsPro: true,
      expected: { active: false, managedByRevenueCat: true, managedOnWeb: false, canPurchase: false, needsVerification: true },
    },
  ])('$name', ({ billing, revenueCatIsPro, pendingRevenueCatVerification = false, expected }) => {
    expect(billingAccessView(billing, revenueCatIsPro, pendingRevenueCatVerification)).toEqual(expected);
  });

  test('keeps verification required when the same local entitlement is evaluated after remount', () => {
    const input = {
      billing: { state: { kind: 'LOCKED', canWrite: false }, provider: 'REVENUECAT' },
      revenueCatIsPro: true,
    };
    const expected = {
      active: false,
      managedByRevenueCat: true,
      managedOnWeb: false,
      canPurchase: false,
      needsVerification: true,
    };

    expect(billingAccessView(input.billing, input.revenueCatIsPro)).toEqual(expected);
    expect(billingAccessView(input.billing, input.revenueCatIsPro)).toEqual(expected);
  });
});
