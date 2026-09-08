export async function refreshRevenueCatData<TCustomer, TOffering>({
  getCustomerInfo,
  getOffering,
  setCustomerInfo,
  setOffering,
}: {
  getCustomerInfo: () => Promise<TCustomer>;
  getOffering: () => Promise<TOffering | null>;
  setCustomerInfo: (customerInfo: TCustomer) => void;
  setOffering: (offering: TOffering | null) => void;
}): Promise<void> {
  try {
    setCustomerInfo(await getCustomerInfo());
  } catch {
    // A transient RevenueCat customer-info failure should not block the app.
  }

  try {
    setOffering(await getOffering());
  } catch {
    // Offerings are optional for account access and must not discard CustomerInfo.
  }
}
