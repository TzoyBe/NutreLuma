# RevenueCat Backend Synchronization Design

**Date:** 2026-09-08

**Status:** Approved in chat; awaiting written-spec review

**Scope:** Native Android/iOS subscriptions on the RevenueCat free plan

## Goal

Make the NutreLuma backend recognize subscriptions bought through RevenueCat while preserving the existing Stripe and PayPal browser flows. The backend remains the authority for write access; the native app never grants server access by merely reporting that a purchase succeeded locally.

## Constraints and Decisions

- RevenueCat Free is used, so there are no RevenueCat webhooks.
- Android and iOS purchases use the existing `react-native-purchases` integration.
- Stripe and PayPal remain available on the web.
- A NutreLuma account may have one authoritative billing provider at a time in the existing `Subscription` record.
- Users with a currently active Stripe, PayPal, or manual subscription keep that provider and are not prompted to buy a duplicate native subscription. They can switch after that access expires.
- RevenueCat is queried immediately after a native purchase or restore, and later when locally cached access needs reconciliation.
- The canonical entitlement identifier is configurable and defaults to `pro`. Store product identifiers are also allow-listed through configuration.
- Production rejects sandbox RevenueCat purchases. Non-production environments may explicitly allow sandbox data.

## Architecture

### Native client

The RevenueCat provider continues to identify customers with the authenticated NutreLuma `user.id`. Public platform SDK keys and the entitlement identifier move from hard-coded empty strings to Expo public environment variables:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`

After `presentPaywall()` or `restorePurchases()` returns an active entitlement, the native billing screen calls the authenticated backend synchronization endpoint and reloads `/api/billing`. The success state shown to the user comes from the refreshed backend billing state, not solely from RevenueCat `CustomerInfo`.

If `/api/billing` reports an active Stripe, PayPal, or manual subscription, the screen shows that plan as active and does not offer a second store purchase. Management remains provider-specific: RevenueCat subscriptions use Customer Center/store management; web subscriptions open the existing web billing page.

### Backend RevenueCat client

A focused server-only module calls:

`GET https://api.revenuecat.com/v1/subscribers/{url-encoded-user-id}`

The request uses `Authorization: Bearer <REVENUECAT_SECRET_API_KEY>`. The secret is never returned by an API route or included in the Expo bundle.

The response parser validates the minimum required shape and derives a provider-neutral subscription snapshot from:

- `subscriber.entitlements[REVENUECAT_ENTITLEMENT_ID]`
- the entitlement's `product_identifier` and `expires_date`
- the corresponding entry in `subscriber.subscriptions[product_identifier]`
- `store_transaction_id`, `purchase_date`, `unsubscribe_detected_at`, `refunded_at`, `grace_period_expires_date`, and `is_sandbox`

An entitlement is accepted only when its identifier matches, its product is allow-listed, its store is `app_store` or `play_store`, its environment is allowed, and its effective expiration/grace date is in the future. Malformed or unexpected responses fail closed without shortening previously paid access.

### Synchronization endpoint

Add `POST /api/billing/revenuecat/sync`.

- Requires the existing authenticated API user.
- Accepts no user ID or subscription evidence from the request body.
- Uses the authenticated `user.id` as the RevenueCat App User ID.
- Applies the verified remote snapshot transactionally.
- Returns the same billing overview shape used by `GET /api/billing`.
- Returns a configuration/service error when RevenueCat is unavailable; it never fabricates active access.

The route may be called after purchase and restore. Repeated calls are safe.

## Persistence

Extend `SubscriptionProvider` with `REVENUECAT` through a Prisma migration. For a RevenueCat-backed subscription:

- `Subscription.provider = REVENUECAT`
- `Subscription.externalId = user.id`
- `status` is `ACTIVE`, `CANCELLED`, or `EXPIRED`
- `accessUntil` is the verified entitlement expiration or grace expiration
- `autoRenew` is false when `unsubscribe_detected_at` or `refunded_at` is present; otherwise true
- `cancelledAt` reflects the detected cancellation/refund when available
- `lastSyncedAt` and `lastSyncError` follow the existing reconciliation conventions

RevenueCat transactions are not inserted into the existing `Payment` table. Its `amountCents` field is mandatory and the RevenueCat customer response does not provide a dependable settled amount; storing the configured list price would invent financial data and make payment history misleading. RevenueCat remains the transaction ledger for native purchases, while `Payment` continues to represent verified Stripe, PayPal, and manual amounts. The RevenueCat `store_transaction_id` is used in synchronization logs only and is never logged in full.

## Provider Switching Rule

The current database has one `Subscription` per user. To avoid silent double billing:

- An active, non-RevenueCat provider remains authoritative.
- The native UI suppresses the RevenueCat purchase CTA while that access is valid.
- If a RevenueCat purchase nevertheless exists, restore/sync verifies it but does not overwrite an active web provider with a later expiration without an explicit switching workflow.
- Once existing access is expired or locked, an active RevenueCat entitlement may become the authoritative provider.

Supporting multiple simultaneously managed provider subscriptions is intentionally outside this change. That would require a separate provider-subscription table and conflict-resolution policy.

## Reconciliation Without Webhooks

`getAccessState()` keeps its fast database-only path while cached access is valid. It calls RevenueCat when:

- the provider is `REVENUECAT` and `accessUntil` has elapsed,
- the state is in grace,
- or the authenticated sync endpoint is explicitly called after purchase/restore.

The existing synchronization cooldown prevents repeated external calls. A successful lookup updates renewal, cancellation, expiration, grace, and refund state. A temporary network or RevenueCat failure stores a sync error and preserves already-paid access; after its allowed grace policy ends, access fails closed until verification succeeds.

Because the Free plan has no webhooks, cancellation is not expected to revoke access immediately. This matches store behavior: cancellation normally disables auto-renewal while access remains valid through the paid period. Renewal is discovered at expiration or through an explicit native sync.

## Configuration

Backend variables:

- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID=pro`
- `REVENUECAT_PRODUCT_IDS` as a comma-separated allow-list
- `REVENUECAT_ALLOW_SANDBOX=false` in production

Native variables:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`

Examples and operations documentation will explain which values belong in the web deployment environment and which public keys belong in EAS environments. No real keys are committed.

## Error Handling and Observability

- RevenueCat HTTP timeouts, non-2xx responses, and invalid JSON map to a typed provider error.
- Logs include the NutreLuma user ID, operation, HTTP status where available, and a stable error code; secrets and full RevenueCat payloads are excluded.
- Missing configuration makes RevenueCat unavailable but does not affect Stripe/PayPal.
- Unknown products, stores, sandbox status, or malformed dates are rejected and logged.
- Database writes are idempotent and transactional where subscription and payment state change together.

## Testing

Tests are written before production changes and cover:

1. RevenueCat client parsing for active monthly/yearly entitlements.
2. Expired, cancelled-but-still-active, refunded, billing-grace, sandbox, wrong-entitlement, wrong-product, and malformed responses.
3. URL encoding and authenticated RevenueCat REST requests without leaking the secret.
4. Successful authenticated sync and rejection of unauthenticated requests.
5. Idempotent repeated syncs without duplicate or regressive subscription updates.
6. Renewal and expiration reconciliation through `getAccessState()`.
7. Provider switching protection for active Stripe/PayPal/manual users.
8. Existing Stripe, PayPal, trial, manual, admin, and billing-disabled behavior remains unchanged.
9. Native purchase/restore triggers backend sync and reloads authoritative billing state.
10. Native UI does not offer duplicate purchase for an active web-managed subscription.

Verification includes focused unit tests, the complete web test suite, Prisma validation/generation, web and native typechecks, and Expo Doctor.

## Rollout

1. Create matching `pro` entitlement and monthly/yearly products in RevenueCat, Google Play Console, and App Store Connect.
2. Deploy the database migration and backend configuration before enabling native keys.
3. Verify sandbox purchases against a non-production backend with sandbox explicitly enabled.
4. Configure production RevenueCat/EAS values and create store builds.
5. Run purchase, restore, cancellation, renewal, reinstall, and cross-device account tests on both stores.
6. Monitor provider sync errors during rollout; Stripe/PayPal remain unaffected and provide rollback isolation.

## Out of Scope

- RevenueCat Pro webhooks.
- Migrating Stripe or PayPal subscriptions into RevenueCat.
- RevenueCat Web Billing.
- Simultaneous active billing-provider records for one user.
- Automated refunds or cancellations through the backend.
