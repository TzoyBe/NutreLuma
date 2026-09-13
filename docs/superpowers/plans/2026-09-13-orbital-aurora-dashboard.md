# Orbital Aurora Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the new orbital NutreLuma dashboard on native and web using existing data, mutations, navigation, and access controls.

**Architecture:** Add a small, tested presentation model per platform and colocated dashboard view components. Existing screen/page containers continue to own fetching and mutations; they pass normalized values and action callbacks into the new views, keeping backend and business behavior unchanged.

**Tech Stack:** Expo 57, React Native 0.86, React 19, react-native-svg, expo-linear-gradient, Next.js 16 App Router, CSS Modules, Vitest.

**Spec:** `docs/design/orbital-aurora-dashboard-spec.md`

## Global Constraints

- Use the current dashboard, goals, water, activity, billing, and notification APIs without adding endpoints.
- Render real values and targets; reference-image numbers are examples only.
- Preserve date navigation, refresh, empty/error states, subscription gating, meal entry, water entry, steps entry, and notification actions.
- Keep motion subtle and respect reduced-motion settings on web.
- Commit and push only `feat/orbital-aurora-dashboard`; do not merge into `main`.

---

### Task 1: Shared dashboard presentation models

**Files:**
- Create: `apps/native/src/orbital-dashboard-model.ts`
- Create: `apps/native/src/orbital-dashboard-model.test.ts`
- Create: `apps/web/src/components/dashboard/orbital-dashboard-model.ts`
- Create: `apps/web/tests/unit/orbital-dashboard-model.test.ts`

**Interfaces:**
- Consumes: calorie and nutrient current/target values already returned by each dashboard container.
- Produces: clamped progress, percent, time-aware greeting, hydration/nutrition insight copy, and focus summary.

- [ ] **Step 1: Write failing tests** covering null targets, clamping, over-target values, and greeting periods.
- [ ] **Step 2: Run the two focused Vitest files and confirm missing-module failures.**
- [ ] **Step 3: Implement pure model builders with no framework dependencies.**
- [ ] **Step 4: Run the focused tests and confirm they pass.**

### Task 2: Native orbital dashboard surface

**Files:**
- Create: `apps/native/src/orbital-dashboard.tsx`
- Create: `apps/native/src/orbital-theme.ts`
- Modify: `apps/native/App.tsx`

**Interfaces:**
- Consumes: normalized calorie/macronutrient/activity values, date state, loading/error state, and callbacks for notification, date, meal, water, and steps actions.
- Produces: responsive orbital dashboard presentation while leaving fetching and mutation ownership in `DashboardScreen`.

- [ ] **Step 1: Add semantic color, spacing, radius, and glow tokens.**
- [ ] **Step 2: Build accessible reusable planet, insight, focus, header, and orbit components using SVG and native gradients.**
- [ ] **Step 3: Replace the old dashboard gauge stage in `DashboardScreen`, preserving refresh and action callbacks.**
- [ ] **Step 4: Update native primary navigation to Home, Insights, Add Meal, Recipes, Profile with the meal action gated by current access.**
- [ ] **Step 5: Run native model tests and TypeScript checking.**

### Task 3: Web orbital dashboard surface

**Files:**
- Create: `apps/web/src/components/dashboard/orbital-dashboard.tsx`
- Create: `apps/web/src/components/dashboard/orbital-dashboard.module.css`
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: the server page's existing dashboard payload, formatted date, URLs for navigation/actions, and existing water/steps components.
- Produces: server-rendered responsive dashboard shell with CSS-module-scoped visuals and functional links.

- [ ] **Step 1: Build the semantic server component and retain native links/forms for every dashboard action.**
- [ ] **Step 2: Implement the orbital responsive layout in a CSS Module, including reduced-motion and high-contrast focus states.**
- [ ] **Step 3: Integrate the component into the dashboard page without changing queries or authorization.**
- [ ] **Step 4: Keep meals, maintenance, drafts, subscription status, and disclaimer available below the hero surface.**
- [ ] **Step 5: Run the web model test, TypeScript checking, and production build.**

### Task 4: Cross-platform verification and branch handoff

**Files:**
- Modify only files needed to resolve issues found by verification.

**Interfaces:**
- Consumes: completed native and web implementations.
- Produces: verified commit and remote feature branch.

- [ ] **Step 1: Run full native and web unit suites.**
- [ ] **Step 2: Run both TypeScript checks and the Next.js production build.**
- [ ] **Step 3: Review the final diff for accidental backend, lockfile, or unrelated changes.**
- [ ] **Step 4: Commit the verified implementation with a feature commit.**
- [ ] **Step 5: Push `feat/orbital-aurora-dashboard` and verify `main` remains unchanged.**
