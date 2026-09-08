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
  const needsVerification = (revenueCatIsPro || pendingRevenueCatVerification) && !backendActive;

  return {
    active: backendActive,
    managedByRevenueCat: provider === 'REVENUECAT',
    managedOnWeb: backendActive && (provider === 'STRIPE' || provider === 'PAYPAL'),
    canPurchase: billing !== null && !backendActive && !revenueCatIsPro && !pendingRevenueCatVerification,
    needsVerification,
  };
}
