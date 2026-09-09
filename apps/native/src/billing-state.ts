import type { BillingOverviewResult } from './api';

export interface BillingAccessView {
  active: boolean;
  managedByRevenueCat: boolean;
  managedOnWeb: boolean;
  canPurchase: boolean;
  needsVerification: boolean;
}

export function billingAccessView(
  billing: Pick<BillingOverviewResult, 'state' | 'provider'> | null,
  revenueCatIsPro: boolean,
  pendingRevenueCatVerification = false,
): BillingAccessView {
  const backendActive = billing?.state?.canWrite === true;
  const provider = billing?.provider?.toUpperCase();
  const managedByRevenueCat = provider === 'REVENUECAT';
  const managedOnWeb = backendActive && (provider === 'STRIPE' || provider === 'PAYPAL');
  const unlimited = billing?.state?.kind === 'UNLIMITED';
  const locked = billing?.state?.kind === 'LOCKED';
  const needsVerification = (revenueCatIsPro || pendingRevenueCatVerification) && !backendActive;

  return {
    active: backendActive,
    managedByRevenueCat,
    managedOnWeb,
    // Δωρεάν trial δεν πρέπει να κρύβει το upsell (ίδια λογική με το web) —
    // αλλά ΠΟΤΕ όταν ήδη πληρώνει αλλού (Stripe/PayPal στο web ή ενεργό
    // RevenueCat), αλλιώς θα κατέληγε με διπλή/επικαλυπτόμενη συνδρομή.
    canPurchase:
      billing !== null &&
      !unlimited &&
      !managedOnWeb &&
      !(managedByRevenueCat && !locked) &&
      !revenueCatIsPro &&
      !pendingRevenueCatVerification,
    needsVerification,
  };
}
