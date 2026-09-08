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
): BillingAccessView {
  const backendActive = billing?.state?.canWrite === true;
  const provider = billing?.provider?.toUpperCase();
  const needsVerification = revenueCatIsPro && !backendActive;

  return {
    active: backendActive,
    managedByRevenueCat: provider === 'REVENUECAT',
    managedOnWeb: backendActive && (provider === 'STRIPE' || provider === 'PAYPAL'),
    canPurchase: billing !== null && !backendActive && !revenueCatIsPro,
    needsVerification,
  };
}
