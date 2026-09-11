# Goals & Profile Personal Universe Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the native Goals and Profile tabs the same simple Personal Universe hierarchy as the dashboard while retaining all current mobile operations.

**Architecture:** Preserve API state and navigation in `App.tsx`, extract pure derived models and reusable presentational primitives into `apps/native/src`, and use existing React Native `Animated`, `expo-blur`, gradients, SVG, and glass components. No new runtime dependency is introduced.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6, React Native Animated, Expo Blur/LinearGradient, React Native SVG, Vitest

**Spec:** `docs/superpowers/specs/2026-09-11-goals-profile-personal-universe-design.md`

## Global Constraints

- Preserve every existing Goals/Profile API call, mutation payload, route transition, billing action, export flow, and deletion confirmation.
- Do not add a navigation framework or animation dependency.
- Keep pull-to-refresh and keyboard avoidance reliable.
- Decorative motion must stop when native reduce-motion is enabled.
- Touch targets should be at least 44×44 points where practical.
- Native changes are committed and pushed; creating a new store binary is outside this plan.

---

### Task 1: Native Goals/Profile summary models

**Files:**
- Create: `apps/native/src/personal-universe-model.ts`
- Create: `apps/native/src/personal-universe-model.test.ts`

**Interfaces:**
- Produces: `buildNativeGoalUniverse(input: NativeGoalUniverseInput): NativeGoalUniverseModel`
- Produces: `buildNativeProfileUniverse(input: NativeProfileUniverseInput): NativeProfileUniverseModel`

- [ ] **Step 1: Write failing tests**

Test literal derived output for nullable macro targets, achievements/badges/milestone counts, two-letter initials, daily-target fallback, age, BMI, current/target weight, activity, and goal labels.

```ts
expect(buildNativeProfileUniverse({ displayName:'Ada Lovelace', dailyTarget:1900, age:31, bmi:22.4 })).toMatchObject({ initials:'AL', dailyTarget:'1900', age:'31', bmi:'22.4' });
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `cd apps/native && corepack pnpm test -- src/personal-universe-model.test.ts`

Expected: FAIL because the model module does not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Use exported discriminated tone values (`'cyan' | 'gold' | 'violet' | 'emerald' | 'blue'`) and string fallbacks. Do not import React Native or API clients into this module.

- [ ] **Step 4: Run tests**

Run: `cd apps/native && corepack pnpm test -- src/personal-universe-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/native/src/personal-universe-model.ts apps/native/src/personal-universe-model.test.ts
git commit -m "feat(native): add universe summary models"
```

---

### Task 2: Reusable native Personal Universe primitives

**Files:**
- Create: `apps/native/src/personal-universe-ui.tsx`
- Modify: `apps/native/App.tsx`

**Interfaces:**
- Produces: `UniverseHero`, `UniverseMetric`, `UniverseActionTile`, `UniverseReveal`, and `useReducedMotionPreference`.
- Consumes: existing `GlassCard`, `colors`, and `LogoMark` passed as children/styles where needed to avoid circular imports.

- [ ] **Step 1: Define props before implementation**

```ts
type UniverseHeroProps = {
  eyebrow: string; title: string; subtitle?: string;
  center: React.ReactNode; satellites: React.ReactNode[];
};
type UniverseRevealProps = { index: number; children: React.ReactNode };
```

- [ ] **Step 2: Implement reduced-motion preference**

Subscribe to `AccessibilityInfo.isReduceMotionEnabled()` and the `reduceMotionChanged` event. Return cleanup that removes the listener. `UniverseReveal` renders immediately when reduction is enabled.

- [ ] **Step 3: Implement restrained animation**

Use one `Animated.Value` per reveal, `Animated.timing` with native driver for opacity/translateY, and a low-amplitude looping hero drift only when reduced motion is false. Never animate width, height, or input-containing layout.

- [ ] **Step 4: Add styles in the new module**

Use deep navy translucent surfaces, bright top-edge borders, cobalt/violet/emerald/gold accents, 24–32px radii, and `overflow: 'hidden'` only on decorative hero surfaces. Ensure content remains legible without BlurView support.

- [ ] **Step 5: Typecheck**

Run: `cd apps/native && corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/native/src/personal-universe-ui.tsx apps/native/App.tsx
git commit -m "feat(native): add personal universe primitives"
```

---

### Task 3: Redesign native Goals overview

**Files:**
- Modify: `apps/native/App.tsx` (`GoalsOverviewScreen` and its screen-specific styles)
- Modify: `apps/native/src/goal-targets.tsx` only if visual parity requires prop-driven tone/size changes.

**Interfaces:**
- Consumes: `buildNativeGoalUniverse`, `UniverseHero`, `UniverseMetric`, `UniverseActionTile`, `UniverseReveal`.
- Preserves: `load`, `saveGoal`, milestone CRUD/actions, suggestions, filters, and `onOpenMaintenance`.

- [ ] **Step 1: Build the model from loaded state**

Derive the hero only after `goal` resolves. Pass calorie/macro values plus achievement, badge, active milestone, and history counts to `buildNativeGoalUniverse`.

- [ ] **Step 2: Replace the top hierarchy**

Render a `UniverseHero` with calories in the center and three macro satellites. Place `Edit goals` and optional `Use suggestion` immediately below. Keep loading and refresh behavior intact.

- [ ] **Step 3: Move editing behind progressive disclosure**

Reuse `editingGoal`; render the current fields in a focused glass editor only while true. `Use suggestion` populates values and opens the editor. A successful save closes it.

- [ ] **Step 4: Recompose journey and smart ideas**

Render achievements, badges, active milestones, and history as compact action tiles. Keep milestone editor/history subscreens unchanged. Display suggestions as horizontally scannable glass cards with Start/Edit actions.

- [ ] **Step 5: Verify screen behavior**

Run: `cd apps/native && corepack pnpm test && corepack pnpm typecheck`

Expected: PASS with no new warnings from TypeScript.

- [ ] **Step 6: Commit**

```bash
git add apps/native/App.tsx apps/native/src/goal-targets.tsx
git commit -m "feat(native): redesign goals universe"
```

---

### Task 4: Redesign native Profile overview

**Files:**
- Modify: `apps/native/App.tsx` (`ProfileOverviewScreen`, `SegmentedTabs`, and screen-specific styles)

**Interfaces:**
- Consumes: `buildNativeProfileUniverse`, `UniverseHero`, `UniverseMetric`, `UniverseActionTile`, `UniverseReveal`.
- Preserves: profile save, activity-target save, coaching toggles/reset, RevenueCat flows, web billing, password change, exports, deletion, settings/notifications/weight/admin/legal navigation, and logout.

- [ ] **Step 1: Add local edit state**

Add `const [editingProfile, setEditingProfile] = useState(false)`. The Profile tab initially shows the identity/health summary; `Edit profile` reveals existing fields. Successful `saveHealthProfile` sets `editingProfile(false)`.

- [ ] **Step 2: Replace identity and health cards with one hero**

Build the profile model from session, health profile, computed age/BMI, activity, goal, current weight, and target weight. Render avatar initials, daily target, name/email, and compact health satellites in one `UniverseHero`.

- [ ] **Step 3: Polish segmented tabs**

Keep four keys (`profile`, `coaching`, `plan`, `account`). Ensure selected state is announced, each target is at least 44 points tall, and the active glass capsule animates with opacity/scale without measuring or animating layout.

- [ ] **Step 4: Preserve secondary and safety hierarchy**

Keep water/steps under Profile after the editable health panel. Keep Coaching and Plan behavior unchanged. Keep export/password/settings links under Account and render Delete account in a non-animated, clearly destructive surface.

- [ ] **Step 5: Verify Profile operations by code path**

Check that every existing handler remains referenced by a visible control in its original tab and that no conditional can hide restore/retry paths when backend verification is pending.

- [ ] **Step 6: Run complete native verification**

Run: `cd apps/native && corepack pnpm test && corepack pnpm typecheck`

Expected: all Vitest tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): redesign profile universe"
```

---

### Task 5: Native visual review and shared delivery

**Files:**
- Modify only files required by observed review defects.

**Interfaces:**
- Produces: verified native source on `main`, visually aligned with the web redesign and current dashboard.

- [ ] **Step 1: Review representative device dimensions**

Check at least one narrow phone and one larger phone/tablet layout. Verify hero clipping, tab labels, keyboard interaction, pull-to-refresh, milestone subscreens, billing actions, and Account danger-zone reachability.

- [ ] **Step 2: Verify reduced motion and accessibility**

Enable reduce motion, confirm decorative loops stop, navigate all controls with accessibility labels, and verify each pressable remains at least 44 points where practical.

- [ ] **Step 3: Fix only observed defects with test-first changes where mechanically testable**

Do not add unrelated navigation, data, or billing refactors.

- [ ] **Step 4: Run final native verification**

Run: `cd apps/native && corepack pnpm test && corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Push native and web commits together**

Run: `git push origin main`

Expected: remote `main` advances without force-push. Continue with the web plan's NAS deploy step; no native store build is started.
