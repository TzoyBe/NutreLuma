export async function presentSubscriptionManagement({
  presentCustomerCenter,
  openURL,
  managementURL,
}: {
  presentCustomerCenter: () => Promise<void>;
  openURL: (url: string) => Promise<unknown>;
  managementURL: string;
}): Promise<void> {
  try {
    await presentCustomerCenter();
  } catch {
    await openURL(managementURL);
  }
}
