import { describe, expect, test } from 'vitest';
import { refreshRevenueCatData } from './revenuecat-refresh';

describe('refreshRevenueCatData', () => {
  test('keeps a refreshed entitlement when offering retrieval fails', async () => {
    const customer = { id: 'customer-1' };
    const receivedCustomers: typeof customer[] = [];
    const receivedOfferings: Array<{ id: string } | null> = [];

    await refreshRevenueCatData({
      getCustomerInfo: async () => customer,
      getOffering: async () => {
        throw new Error('Offerings unavailable');
      },
      setCustomerInfo: (value) => receivedCustomers.push(value),
      setOffering: (value) => receivedOfferings.push(value),
    });

    expect(receivedCustomers).toEqual([customer]);
    expect(receivedOfferings).toEqual([]);
  });
});
