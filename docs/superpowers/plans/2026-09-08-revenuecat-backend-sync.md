# RevenueCat Backend Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backend-gated NutreLuma access recognize verified Android and iOS RevenueCat subscriptions without RevenueCat Pro webhooks, while preserving Stripe and PayPal web subscriptions.

**Architecture:** The native app identifies RevenueCat customers with the authenticated NutreLuma user ID and requests an authenticated backend sync after purchase or restore. A server-only RevenueCat REST client validates the configured entitlement and product, then the existing subscription service stores a provider-neutral snapshot and rechecks it when cached access expires.

**Tech Stack:** Expo SDK 57, React Native 0.86, `react-native-purchases` 10.7, Next.js 16 route handlers, TypeScript, Zod, Prisma 6/PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-revenuecat-backend-sync-design.md`

## Global Constraints

- RevenueCat Free is used; do not add webhook code.
- Stripe and PayPal browser subscriptions remain operational.
- The backend, never native `CustomerInfo`, decides server write access.
- Use the authenticated NutreLuma `user.id` as the RevenueCat App User ID.
- Default entitlement identifier: `pro`; allow-list all accepted store product IDs.
- Reject sandbox purchases in production unless `REVENUECAT_ALLOW_SANDBOX=true` is explicitly configured.
- Do not commit real RevenueCat keys and never expose `REVENUECAT_SECRET_API_KEY` to Expo.
- Do not invent transaction amounts or insert RevenueCat purchases into `Payment`.
- Preserve unrelated working-tree changes.

---

## File Map

- Create `apps/web/src/server/billing/revenuecat.ts`: server REST client, response validation, and provider-neutral mapping.
- Create `apps/web/tests/unit/revenuecat-client.test.ts`: RevenueCat request and parser contract tests.
- Modify `apps/web/src/server/env.ts`: validated RevenueCat server configuration and availability flag.
- Modify `apps/web/prisma/schema.prisma`: add the `REVENUECAT` provider enum member.
- Create `apps/web/prisma/migrations/20260908000000_add_revenuecat_provider/migration.sql`: PostgreSQL enum migration.
- Modify `apps/web/src/lib/billing/access.ts`: include RevenueCat in provider types and automatic-provider grace behavior.
- Modify `apps/web/tests/unit/billing-access.test.ts`: lock in RevenueCat grace behavior.
- Modify `apps/web/src/server/services/subscription.ts`: attach/sync/reconcile RevenueCat while protecting active web providers.
- Modify `apps/web/tests/unit/subscription-service.test.ts`: service behavior and provider-switching tests.
- Create `apps/web/src/app/api/billing/revenuecat/sync/route.ts`: authenticated native synchronization endpoint.
- Create `apps/web/tests/unit/revenuecat-sync-route.test.ts`: route authentication and response tests.
- Modify `apps/native/src/api.ts`: add typed RevenueCat sync request.
- Modify `apps/native/src/revenuecat.tsx`: configure public keys/entitlement through Expo variables.
- Create `apps/native/src/billing-state.ts`: pure provider/display decision helpers.
- Create `apps/native/src/billing-state.test.ts`: native billing-state unit tests.
- Modify `apps/native/App.tsx`: synchronize after purchase/restore and prevent duplicate provider purchases.
- Modify `apps/native/package.json` and `apps/native/package-lock.json`: add the native Vitest test command/dev dependency.
- Modify `.env.example` and `apps/web/.env.example`: document server and Expo RevenueCat variables.
- Modify `apps/native/README.md` and `apps/web/doc/OPERATIONS.md`: document setup, deployment order, and Free-plan reconciliation.

---

### Task 1: RevenueCat Server Configuration and REST Client

**Files:**
- Create: `apps/web/src/server/billing/revenuecat.ts`
- Create: `apps/web/tests/unit/revenuecat-client.test.ts`
- Modify: `apps/web/src/server/env.ts`

**Interfaces:**
- Produces: `RevenueCatSubscription`, `RevenueCatError`, `getRevenueCatSubscription(appUserId: string): Promise<RevenueCatSubscription>`.
- `RevenueCatSubscription` fields: `appUserId`, `active`, `cancelled`, `accessUntil`, `productId`, `store`, `transactionId`, `purchasedAt`.

- [ ] **Step 1: Write failing parser and HTTP contract tests**

Create fixtures inline in `revenuecat-client.test.ts` and assert:

```ts
const active = await getRevenueCatSubscription('user/1');
expect(active).toMatchObject({
  appUserId: 'user/1',
  active: true,
  cancelled: false,
  productId: 'nutreluma_pro_monthly',
  store: 'play_store',
  transactionId: 'GPA.1234',
});
expect(fetchMock).toHaveBeenCalledWith(
  'https://api.revenuecat.com/v1/subscribers/user%2F1',
  expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer rc-secret-test' }) }),
);
```

Add separate tests for an unsubscribe that remains active until expiry, grace-period expiry, refund, expired entitlement, wrong product, sandbox rejection, malformed date, non-2xx response, and request timeout.

- [ ] **Step 2: Run the client test and verify RED**

Run: `npx vitest run tests/unit/revenuecat-client.test.ts`

Expected: FAIL because `@/server/billing/revenuecat` does not exist.

- [ ] **Step 3: Add validated environment fields**

Add these schema/load fields in `env.ts`:

```ts
REVENUECAT_SECRET_API_KEY: z.string().optional().default(''),
REVENUECAT_ENTITLEMENT_ID: z.string().optional().default('pro'),
REVENUECAT_PRODUCT_IDS: z.string().optional().default(''),
REVENUECAT_ALLOW_SANDBOX: z.string().optional().transform((value) => value === 'true'),
```

Export:

```ts
export const revenueCatProductIds = env.REVENUECAT_PRODUCT_IDS
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
export const revenueCatConfigured =
  env.REVENUECAT_SECRET_API_KEY.length > 0 &&
  env.REVENUECAT_ENTITLEMENT_ID.length > 0 &&
  revenueCatProductIds.length > 0;
export const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';
```

- [ ] **Step 4: Implement the minimal RevenueCat client**

Define the public contract:

```ts
export interface RevenueCatSubscription {
  appUserId: string;
  active: boolean;
  cancelled: boolean;
  accessUntil: Date | null;
  productId: string | null;
  store: 'app_store' | 'play_store' | null;
  transactionId: string | null;
  purchasedAt: Date | null;
}

export async function getRevenueCatSubscription(
  appUserId: string,
): Promise<RevenueCatSubscription>;
```

Use `AbortSignal.timeout(10_000)`, URL-encode the user ID, validate the response with Zod, select only `env.REVENUECAT_ENTITLEMENT_ID`, and reject products/stores/environments outside configuration. Choose `max(expires_date, grace_period_expires_date)` as effective access. Mark cancellation from `unsubscribe_detected_at` or `refunded_at`; a cancellation does not revoke access before the effective end.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/unit/revenuecat-client.test.ts`

Expected: all RevenueCat client tests PASS.

- [ ] **Step 6: Commit the server client**

```bash
git add apps/web/src/server/env.ts apps/web/src/server/billing/revenuecat.ts apps/web/tests/unit/revenuecat-client.test.ts
git commit -m "feat(billing): add RevenueCat REST client"
```

---

### Task 2: Persist RevenueCat as a Subscription Provider

**Files:**
- Modify: `apps/web/prisma/schema.prisma:657`
- Create: `apps/web/prisma/migrations/20260908000000_add_revenuecat_provider/migration.sql`
- Modify: `apps/web/src/lib/billing/access.ts:11-80`
- Modify: `apps/web/tests/unit/billing-access.test.ts`

**Interfaces:**
- Consumes: existing `SubscriptionProvider` and `SubscriptionSnapshot`.
- Produces: `REVENUECAT` as a supported automatic provider across Prisma and access resolution.

- [ ] **Step 1: Write the failing access test**

```ts
it('gives an expired auto-renewing RevenueCat subscription local grace', () => {
  const state = resolveAccessState({
    ...base,
    subscription: {
      status: 'ACTIVE',
      provider: 'REVENUECAT',
      accessUntil: days(-1),
      autoRenew: true,
    },
  }, NOW);
  expect(state.kind).toBe('GRACE');
  expect(state.canWrite).toBe(true);
});
```

- [ ] **Step 2: Run the access test and verify RED**

Run: `npx vitest run tests/unit/billing-access.test.ts`

Expected: TypeScript/Vitest FAIL because `REVENUECAT` is not accepted and is not an automatic provider.

- [ ] **Step 3: Add the provider to Prisma and access types**

Add `REVENUECAT` to `SubscriptionProvider`, to `SubscriptionSnapshot['provider']`, and to the `automaticProvider` condition.

Create migration SQL:

```sql
ALTER TYPE "SubscriptionProvider" ADD VALUE IF NOT EXISTS 'REVENUECAT';
```

- [ ] **Step 4: Validate and generate Prisma client**

Run: `npx prisma validate && npx prisma generate`

Expected: both commands succeed.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npx vitest run tests/unit/billing-access.test.ts`

Expected: all access tests PASS.

- [ ] **Step 6: Commit provider persistence**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations/20260908000000_add_revenuecat_provider/migration.sql apps/web/src/lib/billing/access.ts apps/web/tests/unit/billing-access.test.ts
git commit -m "feat(billing): persist RevenueCat provider"
```

---

### Task 3: Synchronize RevenueCat in the Subscription Service

**Files:**
- Modify: `apps/web/src/server/services/subscription.ts`
- Modify: `apps/web/tests/unit/subscription-service.test.ts`

**Interfaces:**
- Consumes: `getRevenueCatSubscription(appUserId)` from Task 1.
- Produces: `syncRevenueCatSubscription(userId: string): Promise<AccessState>` and RevenueCat support in `reconcileSubscription(userId)`.

- [ ] **Step 1: Add failing service tests**

Mock the client with:

```ts
const getRevenueCatSubscriptionMock = vi.fn();
vi.mock('@/server/billing/revenuecat', () => ({
  getRevenueCatSubscription: (...args: unknown[]) =>
    getRevenueCatSubscriptionMock(...(args as [string])),
}));
```

Add tests proving:

```ts
await syncRevenueCatSubscription('user-1');
expect(getRevenueCatSubscriptionMock).toHaveBeenCalledWith('user-1');
expect(store.subs[0]).toMatchObject({
  provider: 'REVENUECAT',
  externalId: 'user-1',
  status: 'ACTIVE',
  autoRenew: true,
});
expect(store.payments).toHaveLength(0);
```

Also test cancellation with remaining access, expiration without reducing a future paid period, renewal reconciliation after cached expiry, repeated sync, provider failure preserving access, and refusal to overwrite an active Stripe/PayPal/manual provider.

- [ ] **Step 2: Run the service test and verify RED**

Run: `npx vitest run tests/unit/subscription-service.test.ts`

Expected: FAIL because `syncRevenueCatSubscription` and RevenueCat reconciliation do not exist.

- [ ] **Step 3: Extend the provider-neutral remote type**

Change the service-local provider union to:

```ts
provider: 'STRIPE' | 'PAYPAL' | 'REVENUECAT';
```

Add a mapper returning no payment:

```ts
function fromRevenueCat(remote: RevenueCatSubscription): RemoteSubscription {
  return {
    provider: 'REVENUECAT',
    active: remote.active,
    cancelled: remote.cancelled,
    currentPeriodEnd: remote.accessUntil,
    payment: null,
  };
}
```

- [ ] **Step 4: Implement explicit synchronization and provider protection**

Implement:

```ts
export async function syncRevenueCatSubscription(userId: string): Promise<AccessState>;
```

Load the current record first. If a non-RevenueCat provider still grants access, return its current access state without overwriting it. Otherwise call RevenueCat, set `externalId` to `userId`, apply the mapped remote state, and return the refreshed access state. Ensure inactive remote state cannot shorten an existing future `accessUntil`.

- [ ] **Step 5: Add RevenueCat to reconciliation**

Allow `reconcileSubscription()` to query RevenueCat when `subscription.provider === 'REVENUECAT'`, passing the stored `externalId`/user ID. Keep the existing cooldown and failure logging behavior. Leave cancellation endpoint support limited to Stripe/PayPal; RevenueCat cancellation is managed through Customer Center/store UI.

- [ ] **Step 6: Run service and access tests and verify GREEN**

Run: `npx vitest run tests/unit/subscription-service.test.ts tests/unit/billing-access.test.ts`

Expected: all tests PASS, including existing Stripe and PayPal cases.

- [ ] **Step 7: Commit subscription synchronization**

```bash
git add apps/web/src/server/services/subscription.ts apps/web/tests/unit/subscription-service.test.ts
git commit -m "feat(billing): synchronize RevenueCat access"
```

---

### Task 4: Add the Authenticated RevenueCat Sync Route

**Files:**
- Create: `apps/web/src/app/api/billing/revenuecat/sync/route.ts`
- Create: `apps/web/tests/unit/revenuecat-sync-route.test.ts`

**Interfaces:**
- Consumes: `requireApiUser()`, `syncRevenueCatSubscription(userId)`, and `getBillingOverview(userId)`.
- Produces: `POST /api/billing/revenuecat/sync` returning `ApiSuccess<BillingOverview>`.

- [ ] **Step 1: Write failing route tests**

Mock authentication and services. Assert the authenticated path calls both services with the server-derived ID:

```ts
const response = await POST(new Request('https://www.nutreluma.com/api/billing/revenuecat/sync', {
  method: 'POST',
}));
expect(syncMock).toHaveBeenCalledWith('user-1');
expect(await response.json()).toEqual({ ok: true, data: overview });
```

Add an unauthenticated case where `requireApiUser` throws `ApiError('UNAUTHENTICATED', ...)` and assert HTTP 401. Assert no request-body user ID is accepted or passed through.

- [ ] **Step 2: Run the route test and verify RED**

Run: `npx vitest run tests/unit/revenuecat-sync-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the route**

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await syncRevenueCatSubscription(user.id);
  return jsonOk(await getBillingOverview(user.id));
});
```

- [ ] **Step 4: Run route tests and verify GREEN**

Run: `npx vitest run tests/unit/revenuecat-sync-route.test.ts`

Expected: all route tests PASS.

- [ ] **Step 5: Commit the endpoint**

```bash
git add apps/web/src/app/api/billing/revenuecat/sync/route.ts apps/web/tests/unit/revenuecat-sync-route.test.ts
git commit -m "feat(api): add RevenueCat sync endpoint"
```

---

### Task 5: Make the Native Billing Flow Backend-Authoritative

**Files:**
- Modify: `apps/native/src/api.ts`
- Modify: `apps/native/src/revenuecat.tsx`
- Create: `apps/native/src/billing-state.ts`
- Create: `apps/native/src/billing-state.test.ts`
- Modify: `apps/native/App.tsx:4380-4410,4958-5002`
- Modify: `apps/native/package.json`
- Modify: `apps/native/package-lock.json`

**Interfaces:**
- Produces: `api.syncRevenueCat(token): Promise<BillingOverviewResult>`.
- Produces: `billingAccessView(billing, revenueCatIsPro)` returning `{ active, managedByRevenueCat, managedOnWeb, canPurchase }`.

- [ ] **Step 1: Install and configure the native test runner**

Run from `apps/native`:

`npm install --save-dev vitest@^4.1.10`

Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing billing-state tests**

Create table-driven cases:

```ts
expect(billingAccessView({
  state: { kind: 'ACTIVE', canWrite: true },
  provider: 'PAYPAL',
}, false)).toEqual({
  active: true,
  managedByRevenueCat: false,
  managedOnWeb: true,
  canPurchase: false,
});
```

Cover `STRIPE`, `PAYPAL`, `MANUAL`, `REVENUECAT`, trial, locked, and locally active RevenueCat awaiting backend sync.

- [ ] **Step 3: Run native tests and verify RED**

Run: `npx vitest run src/billing-state.test.ts`

Expected: FAIL because `billing-state.ts` does not exist.

- [ ] **Step 4: Implement the pure billing view model**

Define:

```ts
export interface BillingAccessView {
  active: boolean;
  managedByRevenueCat: boolean;
  managedOnWeb: boolean;
  canPurchase: boolean;
}

export function billingAccessView(
  billing: Pick<BillingOverviewResult, 'state' | 'provider'> | null,
  revenueCatIsPro: boolean,
): BillingAccessView;
```

Backend `state.canWrite` is authoritative after load. `revenueCatIsPro` only represents the short interval between local purchase success and completion of backend sync.

- [ ] **Step 5: Add the API method and RevenueCat environment configuration**

Add to `api.ts`:

```ts
syncRevenueCat(token: string) {
  return request<BillingOverviewResult>('/api/billing/revenuecat/sync', {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  });
},
```

In `revenuecat.tsx`, replace empty hard-coded keys and the misspelled entitlement with:

```ts
export const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';
```

- [ ] **Step 6: Synchronize purchase and restore in `App.tsx`**

After local purchase/restore succeeds:

```ts
const nextBilling = await api.syncRevenueCat(session.token);
setBilling(nextBilling);
```

Only display success when `nextBilling.state?.canWrite === true`. On sync failure, explain that the store purchase was received but server verification could not complete, and offer Retry/Restore instead of repeating the purchase.

Use `billingAccessView()` to suppress `Go Pro` for active Stripe/PayPal/manual accounts, show web management for web providers, and show Customer Center only for RevenueCat.

- [ ] **Step 7: Run native tests and typecheck**

Run: `npx vitest run src/billing-state.test.ts && npm run typecheck`

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit the native flow**

```bash
git add apps/native/src/api.ts apps/native/src/revenuecat.tsx apps/native/src/billing-state.ts apps/native/src/billing-state.test.ts apps/native/App.tsx apps/native/package.json apps/native/package-lock.json
git commit -m "feat(native): verify RevenueCat purchases with backend"
```

---

### Task 6: Document Configuration and Verify the Integrated System

**Files:**
- Modify: `.env.example`
- Modify: `apps/web/.env.example`
- Modify: `apps/native/README.md`
- Modify: `apps/web/doc/OPERATIONS.md`

**Interfaces:**
- Documents every configuration consumed by Tasks 1 and 5.

- [ ] **Step 1: Add safe configuration examples**

Add empty/non-secret examples:

```dotenv
REVENUECAT_SECRET_API_KEY=
REVENUECAT_ENTITLEMENT_ID=pro
REVENUECAT_PRODUCT_IDS=nutreluma_pro_monthly,nutreluma_pro_yearly
REVENUECAT_ALLOW_SANDBOX=false

EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro
```

State explicitly that only `EXPO_PUBLIC_*` keys enter EAS/native builds and the secret belongs only in the web/backend deployment environment.

- [ ] **Step 2: Document setup and operational behavior**

Document the deployment order, RevenueCat entitlement/product matching, test sandbox configuration, immediate post-purchase sync, expiration-time polling, lack of Free-plan webhooks, and how support can find a customer using the NutreLuma user ID.

- [ ] **Step 3: Run backend verification**

Run from `apps/web`:

`npx prisma validate && npx prisma generate && npm test && npm run typecheck && npm run build`

Expected: every command exits 0.

- [ ] **Step 4: Run native verification**

Run from `apps/native`:

`npm test && npm run typecheck && npx expo-doctor`

Expected: tests/typecheck pass and Expo Doctor reports all checks passed.

- [ ] **Step 5: Review the final diff for secrets and unrelated files**

Run from repository root:

```bash
git diff --check
git diff -- . ':!docs/playstore-step2-listing.md'
rg -n "REVENUECAT_(SECRET_API_KEY|IOS_API_KEY|ANDROID_API_KEY)=[^[:space:]]+" .env.example apps/web/.env.example
```

Expected: no whitespace errors, no committed key values, and no edits outside the planned files or pre-existing user changes.

- [ ] **Step 6: Commit documentation**

```bash
git add .env.example apps/web/.env.example apps/native/README.md apps/web/doc/OPERATIONS.md
git commit -m "docs: add RevenueCat deployment guide"
```

- [ ] **Step 7: Record required external setup**

In the handoff, list the exact values the owner must configure in RevenueCat, Google Play Console, App Store Connect, the backend deployment, and EAS. State that real store purchases cannot be verified locally without those external credentials and store products.
