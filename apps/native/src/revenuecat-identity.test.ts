import { describe, expect, test } from 'vitest';
import { createRevenueCatIdentity } from './revenuecat-identity';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('RevenueCat identity gate', () => {
  test('prevents store actions before successful login, including anonymous users', async () => {
    const identity = createRevenueCatIdentity();
    const login = deferred<string>();
    const actions: string[] = [];
    const operation = async () => { actions.push('purchase'); return true; };
    await identity.run(null, operation);
    const identification = identity.identify('user-a', () => login.promise);
    await identity.run('user-a', operation);
    expect(actions).toEqual([]);
    expect(identity.isReady('user-a')).toBe(false);

    login.resolve('customer-a');
    expect(await identification).toBe('customer-a');
    expect(await identity.run('user-a', operation)).toBe(true);
    expect(actions).toEqual(['purchase']);
  });

  test('keeps purchasing disabled when login fails', async () => {
    const identity = createRevenueCatIdentity();
    await expect(identity.identify('user-a', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    let purchased = false;
    await identity.run('user-a', async () => { purchased = true; });
    expect(purchased).toBe(false);
    expect(identity.isReady('user-a')).toBe(false);
  });

  test('discards previous customer results and serializes account switches', async () => {
    const identity = createRevenueCatIdentity();
    const firstLogin = deferred<string>();
    const started = deferred<void>();
    const calls: string[] = [];
    const first = identity.identify('user-a', () => { calls.push('a'); started.resolve(); return firstLogin.promise; });
    await started.promise;
    const second = identity.identify('user-b', async () => { calls.push('b'); return 'customer-b'; });
    expect(identity.isReady('user-a')).toBe(false);
    await identity.run('user-b', async () => { calls.push('incorrect purchase'); });
    expect(calls).toEqual(['a']);
    firstLogin.resolve('customer-a');
    expect(await first).toBeUndefined();
    expect(await second).toBe('customer-b');
    expect(calls).toEqual(['a', 'b']);
    expect(identity.isReady('user-b')).toBe(true);
  });

  test('does not switch SDK identity under an open paywall or return its result to the next account', async () => {
    const identity = createRevenueCatIdentity();
    await identity.identify('user-a', async () => 'customer-a');
    const paywall = deferred<boolean>();
    const started = deferred<void>();
    const sdkUsers = ['user-a'];
    const purchase = identity.run('user-a', () => { started.resolve(); return paywall.promise; });
    await started.promise;
    const switchAccount = identity.identify('user-b', async () => { sdkUsers.push('user-b'); return 'customer-b'; });
    expect(sdkUsers).toEqual(['user-a']);
    paywall.resolve(true);
    expect(await purchase).toBeUndefined();
    await switchAccount;
    expect(sdkUsers).toEqual(['user-a', 'user-b']);
  });

  test('invalidates in-flight customer and offering writes as soon as the account changes', async () => {
    const identity = createRevenueCatIdentity();
    await identity.identify('user-a', async () => 'customer-a');
    const response = deferred<string>();
    const started = deferred<void>();
    const displayed: string[] = [];
    const refresh = identity.run('user-a', async (isCurrent) => {
      started.resolve();
      const customer = await response.promise;
      if (isCurrent()) displayed.push(customer);
    });
    await started.promise;
    const logout = identity.identify(null, async () => undefined);
    response.resolve('stale-customer-a');
    await refresh;
    await logout;
    expect(displayed).toEqual([]);
    expect(identity.isReady('user-a')).toBe(false);
  });
});
