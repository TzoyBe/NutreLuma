# Subscription-Gated Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Add meal / Add weight / recipe-suggestion CTAs with a "Subscription Required" state (label + navigate-to-billing action) when the user has no write access, on both web and native.

**Architecture:** Reuse existing access-state infrastructure exclusively — no new subscription logic anywhere. Web: `getAccessState(userId)` (server) → `access.canWrite` passed as a prop. Native: `api.billing(token)` (already used by the billing screen) → `result.state?.canWrite`, fetched fail-open alongside each screen's existing data load. Tapping a locked button navigates to billing (web: `/profile/billing` via `next/link`/`useRouter`; native: `presentPaywall()` from the already-in-scope `useRevenueCat()` hook).

**Tech Stack:** Next.js 16 (web), Expo/React Native 57 (native) — same stack as the previous plan in this repo.

## Global Constraints

- Reuse the existing `billing.lockedAction` i18n key on web (`en.ts:517` = "An active subscription is required", `el.ts:527` = "Χρειάζεται ενεργή συνδρομή") — do NOT add a new translation key; this keeps the recipes page consistent with the dashboard's existing wording for the same concept.
- Native has no i18n — hardcode the English string `"Subscription Required"` directly in the JSX, matching this file's existing hardcoded-label convention.
- A `canWrite`/billing fetch failure must default to **fail-open** (`canWrite: true`) — the backend's `requireWriteAccess()` remains the real enforcement boundary; this UI gate must never itself cause a false lockout on a transient network error. Native's `DashboardScreen.load()` already uses this exact `.catch(() => null)` pattern for `goals`/`water`/`activity` — follow it.
- Do not touch `requireWriteAccess`, `resolveAccessState`, or any other backend gating logic — this plan is frontend-only.
- Do not touch the weight form's own submit button (`weight-panel.tsx`) or the meal-add screen's internal submit flows — only the 3 named entry-point/action buttons are in scope.
- Run `npx tsc --noEmit` (web) / `npm run typecheck` (native) before committing each task.

---

### Task 1: Web — make the dashboard's existing locked state tappable

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx:104-109`

**Context:** The dashboard already gates Add-meal/Add-weight — when `!access.canWrite` it renders a static locked bar with `t('billing.lockedAction')` (lines 104-109), but it's a plain `<div>`, not clickable. This task makes it navigate to `/profile/billing` on tap, matching `SubscriptionBanner`'s existing convention.

**Interfaces:**
- Consumes: `access.canWrite` (already computed at line 46-51 via `getAccessState(user.id)`, already in scope) — no new fetch needed.

- [ ] **Step 1: Wrap the locked bar in a `Link`**

Replace (in `apps/web/src/app/(app)/dashboard/page.tsx`):

```tsx
      ) : (
        <div className="liquid-control flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-muted-foreground sm:h-14 sm:rounded-full sm:text-base">
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          {t('billing.lockedAction')}
        </div>
      )}
```

with:

```tsx
      ) : (
        <Link
          href="/profile/billing"
          className="liquid-control flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:h-14 sm:rounded-full sm:text-base"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          {t('billing.lockedAction')}
        </Link>
      )}
```

(`Link` is already imported at the top of this file — no new import needed.)

- [ ] **Step 2: Typecheck and build**

```
net use X: \\tzoybe-nas\Container\nutreluma
cd X:\apps\web
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed.

- [ ] **Step 3: Visual check**

Run the dev server, view `/dashboard` as a locked-state account (or temporarily force `access.canWrite = false` in a local test), confirm the bar is now a clickable link that navigates to `/profile/billing`, and that an active/trial/grace account still sees the two normal buttons unchanged.

- [ ] **Step 4: Commit and push**

```bash
git add "apps/web/src/app/(app)/dashboard/page.tsx"
git commit -m "feat(web): make dashboard's subscription-locked state tappable"
git push
```

---

### Task 2: Web — gate the recipe-suggestion generate button

**Files:**
- Modify: `apps/web/src/app/(app)/recipes/page.tsx`
- Modify: `apps/web/src/components/recipes/daily-plan-panel.tsx`

**Interfaces:**
- Consumes: `getAccessState` from `@/server/services/subscription` (already used identically in `dashboard/page.tsx`).
- Produces: `DailyPlanPanel` gains a new required prop `canWrite: boolean`.

- [ ] **Step 1: Fetch access state on the Recipes page**

In `apps/web/src/app/(app)/recipes/page.tsx`, add the import:

```ts
import { getAccessState } from '@/server/services/subscription';
```

Change:

```ts
  const date = todayISO(profile.timezone);
  const [plan, saved] = await Promise.all([
    getCurrentRecipePlan(user.id, date),
    listSavedRecipes(user.id),
  ]);
```

to:

```ts
  const date = todayISO(profile.timezone);
  const [plan, saved, access] = await Promise.all([
    getCurrentRecipePlan(user.id, date),
    listSavedRecipes(user.id),
    getAccessState(user.id),
  ]);
```

Then change the `<DailyPlanPanel date={date} />` line to:

```tsx
      <DailyPlanPanel date={date} canWrite={access.canWrite} />
```

- [ ] **Step 2: Gate the button in `DailyPlanPanel`**

In `apps/web/src/components/recipes/daily-plan-panel.tsx`:

Add imports:
```ts
import { useRouter } from 'next/navigation';
```

Change the component signature:

```ts
export function DailyPlanPanel({ date }: { date: string }) {
```
to:
```ts
export function DailyPlanPanel({ date, canWrite }: { date: string; canWrite: boolean }) {
```

Add, right after the existing `const t = useT();` line:
```ts
  const router = useRouter();
```

Replace the generate button:

```tsx
        <Button onClick={() => void generate(Boolean(plan))} loading={loading}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {plan ? t('recipes.newSuggestion') : t('recipes.createSuggestions')}
        </Button>
```

with:

```tsx
        <Button
          onClick={canWrite ? () => void generate(Boolean(plan)) : () => router.push('/profile/billing')}
          loading={canWrite && loading}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {canWrite ? (plan ? t('recipes.newSuggestion') : t('recipes.createSuggestions')) : t('billing.lockedAction')}
        </Button>
```

(`loading` is forced to `false` when `!canWrite` since the button no longer triggers `generate` in that state — this avoids a stale `loading` value ever showing a spinner on a locked button.)

- [ ] **Step 3: Typecheck and build**

```
cd X:\apps\web
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed.

- [ ] **Step 4: Visual check**

View `/recipes` as a locked-state account, confirm the button reads the locked-state text and navigates to `/profile/billing` on click without calling the generate API. Confirm an active/trial account sees the normal generate flow unchanged (including the loading spinner while generating).

- [ ] **Step 5: Commit, push, and redeploy**

```bash
git add "apps/web/src/app/(app)/recipes/page.tsx" apps/web/src/components/recipes/daily-plan-panel.tsx
git commit -m "feat(web): gate recipe-suggestion generation behind subscription check"
git push
```
Redeploy to the NAS (same `deploy.sh` command used throughout this project) so both web tasks are live together.

---

### Task 3: Native — gate the dashboard's Add meal / Add weight cards

**Files:**
- Modify: `apps/native/App.tsx` (`DashboardScreen`, ~line 5851)

**Interfaces:**
- Consumes: `api.billing(token)` (existing, `apps/native/src/api.ts:1011`), `useRevenueCat()` (existing, imported at the top of `App.tsx` from `./src/revenuecat`).

- [ ] **Step 1: Fetch billing state fail-open, alongside the existing load**

In `DashboardScreen`, add a new state variable alongside the existing ones (near `const [dashboard, setDashboard] = useState<DashboardResult | null>(null);`):

```ts
  const [canWrite, setCanWrite] = useState(true);
```

In the existing `load()` function, extend the `Promise.all` to also fetch billing, fail-open exactly like the existing `goalsRes`/`waterRes`/`activityRes` calls:

```ts
      const [dash, goalsRes, waterRes, activityRes, billingRes] = await Promise.all([
        api.dashboard(session.token, date),
        api.goals(session.token).catch(() => null),
        api.waterEntries(session.token, { limit: 50 }).catch(() => null),
        api.activityEntries(session.token, { limit: 50 }).catch(() => null),
        api.billing(session.token).catch(() => null),
      ]);
      setDashboard(dash);
      setCanWrite(billingRes?.state?.canWrite ?? true);
```

(Insert `setCanWrite(...)` right after `setDashboard(dash);`, before the existing `setWaterTarget(...)` line — order relative to the other `set*` calls doesn't matter, just keep it inside the `try` block alongside them.)

- [ ] **Step 2: Get `presentPaywall` in scope**

Add, near the top of `DashboardScreen`'s body (alongside the other hook calls, e.g. right after the `useState` declarations):

```ts
  const { presentPaywall } = useRevenueCat();
```

- [ ] **Step 3: Gate the two FAB-sheet cards**

Replace the two `Pressable` cards (currently ~lines 6183-6209):

```tsx
          <Pressable
            style={({ pressed }) => [styles.addChoiceCard, pressed && styles.addChoiceCardPressed]}
            onPress={() => {
              setShowAddChoice(false);
              onAddMeal();
            }}
          >
            <View style={[styles.addChoiceCardIcon, { backgroundColor: colors.primarySoft }]}>
              <Plus size={26} color={colors.primary} />
            </View>
            <Text style={styles.addChoiceCardTitle}>Add meal</Text>
            <Text style={styles.addChoiceCardSubtitle}>Photo, gallery or manual entry</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.addChoiceCard, pressed && styles.addChoiceCardPressed]}
            onPress={() => {
              setShowAddChoice(false);
              onOpenWeight();
            }}
          >
            <View style={[styles.addChoiceCardIcon, { backgroundColor: colors.accentSoft }]}>
              <Scale size={26} color={colors.accent} />
            </View>
            <Text style={styles.addChoiceCardTitle}>Add weight</Text>
            <Text style={styles.addChoiceCardSubtitle}>Log today's weigh-in</Text>
          </Pressable>
```

with:

```tsx
          <Pressable
            style={({ pressed }) => [styles.addChoiceCard, pressed && styles.addChoiceCardPressed]}
            onPress={() => {
              setShowAddChoice(false);
              if (canWrite) onAddMeal();
              else void presentPaywall();
            }}
          >
            <View style={[styles.addChoiceCardIcon, { backgroundColor: colors.primarySoft }]}>
              <Plus size={26} color={colors.primary} />
            </View>
            <Text style={styles.addChoiceCardTitle}>{canWrite ? 'Add meal' : 'Subscription Required'}</Text>
            <Text style={styles.addChoiceCardSubtitle}>
              {canWrite ? 'Photo, gallery or manual entry' : 'Subscribe to keep logging meals'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.addChoiceCard, pressed && styles.addChoiceCardPressed]}
            onPress={() => {
              setShowAddChoice(false);
              if (canWrite) onOpenWeight();
              else void presentPaywall();
            }}
          >
            <View style={[styles.addChoiceCardIcon, { backgroundColor: colors.accentSoft }]}>
              <Scale size={26} color={colors.accent} />
            </View>
            <Text style={styles.addChoiceCardTitle}>{canWrite ? 'Add weight' : 'Subscription Required'}</Text>
            <Text style={styles.addChoiceCardSubtitle}>
              {canWrite ? "Log today's weigh-in" : 'Subscribe to keep logging weight'}
            </Text>
          </Pressable>
```

- [ ] **Step 4: Typecheck**

```
net use X: \\tzoybe-nas\Container\nutreluma
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 5: Commit and push**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): gate dashboard add-meal/add-weight cards behind subscription check"
git push
```

---

### Task 4: Native — gate the recipe-suggestion generate button

**Files:**
- Modify: `apps/native/App.tsx` (`RecipesOverviewScreen`, ~line 4041)

**Interfaces:**
- Consumes: `api.billing(token)`, `useRevenueCat()` — same as Task 3.

- [ ] **Step 1: Fetch billing state fail-open**

In `RecipesOverviewScreen`, add new state alongside the existing ones:

```ts
  const [canWrite, setCanWrite] = useState(true);
```

In the existing `load()` function, extend it to also fetch billing:

```ts
  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage(null);
    try {
      const [recipesResult, billingRes] = await Promise.all([
        api.recipes(session.token),
        api.billing(session.token).catch(() => null),
      ]);
      setRecipes(Array.isArray(recipesResult.recipes) ? recipesResult.recipes : []);
      setSavedPlanTitles(recipesResult.recipes.map((item) => item.recipe.title ?? '').filter(Boolean));
      setCanWrite(billingRes?.state?.canWrite ?? true);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
```

(This replaces the existing single-await `const recipesResult = await api.recipes(session.token);` with the `Promise.all` shown above — the `recipesResult`-derived lines stay exactly the same, just now reading from the destructured `Promise.all` result.)

- [ ] **Step 2: Get `presentPaywall` in scope**

Add near the top of `RecipesOverviewScreen`'s body:

```ts
  const { presentPaywall } = useRevenueCat();
```

- [ ] **Step 3: Gate the generate button**

Replace:

```tsx
            <Pressable
              onPress={generatePlan}
              disabled={generating}
              style={[styles.actionButton, styles.actionPrimary, styles.actionFull]}
            >
              <Text style={styles.actionPrimaryText}>
                {generating ? 'Generating...' : planMeals.length ? 'New suggestions' : 'Generate plan'}
              </Text>
            </Pressable>
```

with:

```tsx
            <Pressable
              onPress={canWrite ? generatePlan : () => void presentPaywall()}
              disabled={canWrite && generating}
              style={[styles.actionButton, styles.actionPrimary, styles.actionFull]}
            >
              <Text style={styles.actionPrimaryText}>
                {!canWrite
                  ? 'Subscription Required'
                  : generating
                    ? 'Generating...'
                    : planMeals.length
                      ? 'New suggestions'
                      : 'Generate plan'}
              </Text>
            </Pressable>
```

- [ ] **Step 4: Typecheck**

```
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 5: Commit and push**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): gate recipe-suggestion generation behind subscription check"
git push
```

---

### Task 5: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full web test suite, typecheck, build**

```
cd X:\apps\web
npx vitest run
npx tsc --noEmit
npm run build -- --webpack
```
Expected: all green (no test changes expected from this plan — confirm nothing regressed).

- [ ] **Step 2: Full native test suite and typecheck**

```
cd X:\apps\native
npx vitest run
npm run typecheck
```
Expected: all green.

- [ ] **Step 3: Confirm web deploy is current**

If Task 2 already redeployed and Tasks 3-4 (native-only) made no further web changes, no additional deploy is needed. Otherwise redeploy using the project's standard `deploy.sh` NAS command.

- [ ] **Step 4: Note the native rollout**

Native changes ship on the next EAS build, same as this project's other pending native work — no immediate action beyond what's already been communicated.
