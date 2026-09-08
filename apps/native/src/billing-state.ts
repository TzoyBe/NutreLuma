import type { BillingOverviewResult } from './api';

export interface BillingAccessView {
  active: boolean;
  managedByRevenueCat: boolean;
  managedOnWeb: boolean;
  canPurchase: boolean;
}

export function billingAccessView(
  billing: Pick<BillingOverviewResult, 'state' | 'provider'> | null,
  revenueCatIsPro: boolean,
): BillingAccessView {
  const backendActive = billing?.state?.canWrite === true;
  const awaitingBackendSync = billing === null && revenueCatIsPro;
  const provider = billing?.provider?.toUpperCase();
  const active = backendActive || awaitingBackendSync;

  return {
    active,
    managedByRevenueCat: provider === 'REVENUECAT' || awaitingBackendSync,
    managedOnWeb: backendActive && (provider === 'STRIPE' || provider === 'PAYPAL'),
    canPurchase: billing !== null && !active,
  };
}
