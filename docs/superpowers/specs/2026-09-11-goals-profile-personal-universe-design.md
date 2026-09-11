# Goals & Profile — Personal Universe redesign

**Date:** 2026-09-11
**Status:** Approved direction

## Purpose

Redesign the primary Goals and Profile experiences on NutreLuma web and mobile so they feel like a direct continuation of the Personal Universe landing/auth concept and the orbit-based mobile dashboard. The result must be simpler to scan and operate, visually polished, and distinctly iOS-like without hiding or removing existing capabilities.

## Scope

### Included

- Web `/goals` and `/profile` primary pages.
- Mobile `GoalsOverviewScreen` and `ProfileOverviewScreen` primary tab views.
- Shared visual primitives needed by those screens: hero surfaces, orbit/ring summaries, glass action tiles, segmented controls, expandable editing surfaces, and restrained motion.
- Responsive behavior, loading/error/empty states, keyboard focus, reduced-motion behavior, and mobile touch targets.
- Existing data loading, save operations, validation, navigation, and account/billing behavior remain intact.

### Not included

- Functional redesign of Achievements, Maintenance, Billing, admin, or destructive account flows.
- New backend endpoints, schema changes, or business rules.
- A pixel-identical web/mobile implementation. Each platform uses its native layout and motion capabilities while sharing the same hierarchy and visual language.

## Considered approaches

1. **Shared visual grammar, platform-native implementation — selected.** Web and mobile share hierarchy, color semantics, glass depth, orbital motifs, and motion timing while using CSS on web and React Native/Expo primitives on mobile. This gives strong brand parity without compromising performance or native interaction.
2. **Exact visual clone across platforms.** Highest screenshot parity, but brittle across screen sizes and likely to feel like a web mockup inside the native app.
3. **Surface-only reskin.** Lowest implementation risk, but would leave the current dense information architecture unchanged and would not deliver the requested simplicity.

## Visual direction

The screens use the Personal Universe concept as a system rather than decoration:

- Deep navy canvas with restrained cobalt, violet, cyan, emerald, and warm-gold light sources.
- Layered translucent surfaces with a bright top edge, subtle internal refraction, and soft depth shadows.
- A single orbital hero on each screen. Supporting cards remain quieter so the screen does not become visually noisy.
- Rounded geometry follows the existing NutreLuma glass system; no new unrelated visual theme is introduced.
- Typography remains the product typography already loaded by each platform. Hierarchy comes from scale, weight, spacing, and numeric emphasis rather than adding another font dependency.

### Motion

- Hero rings and small light particles use slow, low-amplitude drift.
- Cards enter with one coordinated stagger, not independent perpetual animations.
- Segmented-control selection moves with a short spring/slide response.
- Expand/collapse surfaces animate opacity and vertical displacement.
- Press interactions use subtle scale and highlight feedback.
- `prefers-reduced-motion` on web and the native reduce-motion setting disable decorative motion while preserving state transitions.

## Goals experience

### Primary hierarchy

1. **Goal orbit hero:** calories at the center, protein/carbohydrate/fat as satellites, and a concise status line. This visually connects Goals to the existing dashboard.
2. **Primary actions:** `Edit goals` and, when available, `Use suggestion` live directly below the hero.
3. **Journey strip:** achievements, badges, active milestones, and history appear as compact glass destinations with counts.
4. **Smart ideas:** milestone suggestions appear as a horizontally scannable set of concise cards.
5. **Secondary destinations:** Weight Maintenance and full goal history remain accessible but visually quieter.

### Editing

- Daily goal inputs are hidden until `Edit goals` is activated.
- On web they expand in place within a focused glass editor.
- On mobile they appear as a glass sheet/expanded panel suited to keyboard interaction.
- Existing validation, suggestion application, and save behavior are unchanged.

### Empty and error states

- Loading uses a calm orbit placeholder rather than a full blank card.
- Failure states retain retry/pull-to-refresh and explain the next action.
- No-milestone states point directly to smart ideas or custom creation.

## Profile experience

### Primary hierarchy

1. **Identity hero:** avatar/initial, name, email, plan status, and the daily calorie target in one restrained orbital glass composition.
2. **Four-way segmented navigation:** Profile, Coaching, Plan, Account remains the information architecture, with a clearer active indicator and horizontal scrolling/fallback on narrow widths.
3. **Profile summary first:** age, BMI, current weight, target weight, activity, and goal appear as readable summary chips/cards.
4. **Edit on demand:** profile fields remain hidden until `Edit profile`; saving returns the user to the summary.
5. **Secondary settings:** water/steps targets, coaching controls, billing, exports, notifications, legal links, and account actions retain their existing tabs and behavior.

### Safety hierarchy

- Destructive account actions remain inside Account and receive no decorative animation.
- Billing and destructive controls keep explicit labels and current confirmation behavior.
- Status and error messages remain adjacent to the action that produced them where feasible.

## Web architecture

- Keep server data fetching in the existing Goals and Profile route components.
- Add small presentational components under `src/components/goals/` and `src/components/profile/` rather than growing route files.
- Reuse `Card`, `buttonVariants`, existing field components, dashboard gauge conventions, and the current CSS token system.
- Add narrowly scoped Personal Universe application classes/keyframes to `globals.css`; avoid duplicating the public landing component or shipping decorative image assets.
- Keep client state local to the existing `GoalsPanel` and `ProfileTabs` boundaries.

## Mobile architecture

- Preserve the current API calls and screen routing in `App.tsx`.
- Extract reusable presentational pieces into `apps/native/src/` where doing so reduces the current monolithic screen complexity.
- Reuse `GlassCard`, `GlassSheet`, `GoalTargets`, dashboard orbit semantics, and existing brand colors.
- Use the existing animation stack and native/Expo capabilities already installed; do not add a heavy animation dependency solely for decoration.
- Keep vertical scrolling stable and never animate layout in a way that fights keyboard avoidance or pull-to-refresh.

## Responsive and accessibility requirements

- Web supports narrow mobile widths through desktop without horizontal page scrolling.
- Mobile supports small phones and larger tablets with bounded content width.
- Interactive targets are at least 44×44 CSS/native points where practical.
- Every icon-only control has an accessible label; tabs expose selected state; expanding editors expose expanded state.
- Text and control contrast remains readable over glass surfaces.
- Decorative orbits and particles are hidden from assistive technology.
- Core information and actions remain available when blur or motion is unavailable.

## Testing and verification

- Add unit tests for any new pure presentation helpers, derived summary models, and behavior boundaries.
- Extend web component tests for the Goals/Profile progressive-disclosure behavior where the existing test stack supports it.
- Run the complete web unit suite and TypeScript check.
- Run native TypeScript checks and relevant unit tests.
- Run production web build through the NAS Docker deployment.
- Verify public `/api/health`, protected route availability, and the deployed build artifacts.
- Perform screenshot-level visual review at narrow and desktop web widths plus at least one representative mobile viewport when the local runtime permits it.

## Delivery

- Commit implementation and tests to `main` only after verification.
- Push to `origin/main`.
- Deploy the web application with the repository's NAS `deploy.sh` and confirm the health endpoint.
- Native source changes are committed and pushed; producing or publishing a new store binary is outside this scope unless separately requested.
