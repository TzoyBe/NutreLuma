import { describe, expect, it, vi } from 'vitest';
import { presentSubscriptionManagement } from './revenuecat-management';

describe('presentSubscriptionManagement', () => {
  it('falls back to the store management URL when Customer Center is unavailable', async () => {
    const presentCustomerCenter = vi.fn().mockRejectedValue(new Error('plan unavailable'));
    const openURL = vi.fn().mockResolvedValue(undefined);

    await presentSubscriptionManagement({
      presentCustomerCenter,
      openURL,
      managementURL: 'https://play.google.com/store/account/subscriptions',
    });

    expect(presentCustomerCenter).toHaveBeenCalledOnce();
    expect(openURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
  });

  it('does not open the store URL when Customer Center succeeds', async () => {
    const presentCustomerCenter = vi.fn().mockResolvedValue(undefined);
    const openURL = vi.fn().mockResolvedValue(undefined);

    await presentSubscriptionManagement({
      presentCustomerCenter,
      openURL,
      managementURL: 'https://apps.apple.com/account/subscriptions',
    });

    expect(openURL).not.toHaveBeenCalled();
  });
});
