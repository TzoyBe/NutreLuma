# Subscription-Gated Action Buttons — Design Spec

**Date:** 2026-09-13
**App:** NutreLuma (`\\tzoybe-nas\Container\nutreluma`, apps/web + apps/native)
**Status:** Approved — proceeding to implementation plan.

## Goal

When a user has no write access (expired trial, expired/cancelled subscription — anything the existing `AccessStateKind` resolves to `LOCKED`), the primary CTA buttons for **Add meal**, **Add weight**, and **Recipe suggestion generation** must not let the user attempt the action and hit a generic error toast. Instead each button shows **"Subscription Required"** and, when tapped, navigates to the billing page/screen instead of performing the write.

## Non-goals

- No change to backend gating — `requireWriteAccess()` already blocks every write with a 402 `SUBSCRIPTION_REQUIRED`; this work is frontend-only.
- No change to any other write action (milestones, activity, goals, pantry, etc.) — explicitly out of scope per user decision.
- No new subscription-state computation — reuse `getAccessState`/`AccessStateKind` (web) and `api.billing()` → `state.canWrite` (native), both of which already exist and already back `SubscriptionBanner`/the billing screen.
- No change to the existing `SubscriptionBanner` passive reminder — it stays as-is; this adds a second, more direct signal at the point of action.

## Existing infrastructure (verified, reused as-is)

- Web: `apps/web/src/lib/billing/access.ts` — `AccessStateKind = 'UNLIMITED'|'TRIAL'|'ACTIVE'|'GRACE'|'LOCKED'`, `resolveAccessState(...)`. `apps/web/src/server/services/subscription.ts` — `getAccessState(userId): Promise<AccessState>` (`{ kind, canWrite, ... }`). Existing consumer: `apps/web/src/components/billing/subscription-banner.tsx` (renders `t('billing.locked')` + a `/profile/billing` link when `kind === 'LOCKED'`).
- Native: `apps/native/src/api.ts` — `api.billing(token): Promise<BillingOverviewResult>` where `result.state?.canWrite: boolean` — already used by the billing screen's paywall logic (`billing-state.ts`).

## Buttons gated (6 total: 3 flows × 2 platforms)

| Flow | Web | Native |
|---|---|---|
| Add meal | `apps/web/src/app/(app)/dashboard/page.tsx:89-95` — `<Link href="/meals/add">{t('dashboard.addMeal')}</Link>` | `apps/native/App.tsx:6183-6194` — FAB-sheet "Add meal" card, `onPress={onAddMeal}` |
| Add weight | `apps/web/src/app/(app)/dashboard/page.tsx:96-102` — `<Link href="/weight">{t('weight.addEntry')}</Link>` | `apps/native/App.tsx:6197-6208` — FAB-sheet "Add weight" card, `onPress={onOpenWeight}` |
| Recipe suggestion | `apps/web/src/components/recipes/daily-plan-panel.tsx:109-112` — generate button, `onClick={() => void generate(...)}` | `apps/native/App.tsx:4216-4224` — generate button, `onPress={generatePlan}` |

Add-meal and add-weight are gated at the **dashboard entry point** (not the deeper form/submit button) — a locked user sees the wall immediately, not after navigating in. Recipe suggestion has only one combined entry+action button on each platform, so that one button is gated directly.

The weight form's own "Save" submit button (`weight-panel.tsx:164-166`) and the meal-add screen's internal submit buttons are **not** touched — they're already correctly blocked server-side with a 402, and a locked user should never reach them anyway once the dashboard entry point is gated. (A user could still deep-link to `/weight` or `/meals/add` directly and hit the existing toast-based 402 handling — acceptable, matches current behavior, out of scope to change.)

## Behavior when locked

- **Label:** replace the button's normal label with a new i18n key, e.g. `t('billing.subscriptionRequired')` = "Subscription Required" (en) / Greek equivalent, added to both `en.ts` and `el.ts` under the existing `billing` namespace (source language is Greek per project convention — Greek copy first, English translation alongside).
- **Style:** visually muted/disabled treatment, consistent with `SubscriptionBanner`'s locked-state look (`border-destructive/40 bg-destructive/10` family on web; the native equivalent muted color already used for disabled states in `styles.ts`/inline styles elsewhere).
- **Action:** tapping/clicking navigates to the billing destination instead of performing the original action — web: `/profile/billing` (same href `SubscriptionBanner` already uses); native: the existing billing screen (whatever prop/handler already opens it — needs confirming the exact prop name during planning, e.g. an `onOpenBilling` callback already passed to these screens, or `presentPaywall()` if that's the established native entry point for "go subscribe").
- **No confirmation dialog, no toast** — direct navigation, since the label itself communicates why.

## Data flow

- Web `dashboard/page.tsx` (already a server component fetching the user's profile) additionally calls `getAccessState(user.id)` and passes `canWrite` as a prop to whatever renders the two Link buttons (inline in the page, or extracted if the page is already large — decide at implementation time based on current file size).
- Web `recipes/page.tsx` (already fetches user/profile server-side) additionally calls `getAccessState(user.id)` and passes `canWrite` to `<DailyPlanPanel>` as a new prop.
- Native `DashboardScreen` additionally calls `api.billing(session.token)` alongside its existing `api.dashboard()` call, extracts `canWrite`, and passes it to wherever the FAB-sheet cards are rendered.
- Native `RecipesOverviewScreen` additionally calls `api.billing(session.token)` and uses `canWrite` to gate its generate button.

All 4 fetches are additive to `Promise.all`s that already exist in each of these components/screens (same "don't couple a new fetch's failure into breaking existing content" lesson from the previous plan applies here). If the `canWrite` fetch itself fails (network error, etc.), default to `canWrite: true` — fail open for this UI gate only. The backend's `requireWriteAccess` remains the actual enforcement boundary and will still correctly reject the write with a 402 if the user truly lacks access, so failing open here can't be exploited to bypass payment — it only prevents a transient network hiccup on the billing check from turning into a false "Subscription Required" wall.

## Error handling

- If the new `canWrite`-fetch itself fails (network error, etc.), treat as `canWrite: true` (fail-open for the UI gate only — the backend remains the actual enforcement boundary, so this can't be exploited to bypass payment).
- Existing 402 toast/error handling for users who reach a write endpoint some other way (direct navigation, race condition where subscription expires mid-session) stays exactly as it is today — unchanged.

## Testing

- Web: no new pure functions are introduced (this is prop-threading + conditional rendering), so no new unit test files are strictly required by the plan's own TDD convention — but each of the 3 gated buttons' conditional render (locked vs. unlocked label/href) is simple enough to unit-test with a lightweight component test if the codebase has a precedent for that (check during planning; if not, a manual verification pass suffices, consistent with how Tasks 7-10 of the previous plan verified native screens by typecheck + visual check only).
- Native: same — verify via typecheck + a manual/visual pass once a build is available (native app run is not available in this environment, as established in the previous plan's work).
- Manual verification (both platforms, once implemented): temporarily force a `LOCKED` state (e.g. test account with expired trial, or by directly testing against `resolveAccessState`'s branching in isolation) and confirm all 3 buttons show "Subscription Required" and route to billing; confirm an `ACTIVE`/`TRIAL`/`UNLIMITED`/`GRACE` account sees the normal buttons unchanged.

## Rollout

Single implementation pass, both platforms. Deploy web to NAS on completion (per project convention); native ships on the next EAS build (already pending from the previous plan's native changes — no additional urgency beyond that).
