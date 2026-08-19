# Interactive Radial Gauges — Water & Steps (web + mobile)

**Date:** 2026-08-17
**Scope:** Nutreluma web (`nutreluma`) + mobile (`nutreluma-native`), shared backend API.

## Goal

Make the read-only water and steps rings on the dashboard **interactive**. The user
drags around the ring (mouse on web, finger on mobile) to set **today's logged
value**, snapping to **50 ml** (water) / **50 steps** (steps). Releasing commits the
change. Only enabled for "today"; past days stay read-only. The existing quick-add
buttons (+250/+500 water, +500/+1000 steps) are **removed** — all logging goes
through the drag.

## Decisions (from brainstorming)

1. **What drag changes:** the *consumed* value (today's logged water/steps), not the target.
2. **Decrease allowed:** yes, via a **correction delta entry** (may be negative).
3. **Gesture:** **angular** — drag around the ring, arc fills to the drag point.
4. **Quick-add buttons:** removed; drag only.
5. **Scale headroom:** ring `0 → 100%` maps to `0 → scaleMax`, where
   **`scaleMax = 1.5 × target`** (so the user can log above target). If no target is
   set, defaults: water `3000 ml`, steps `10000`. The colored fill and handle share
   the same mapping (`value / scaleMax`). A subtle tick/marker at the `target`
   position (66.7%) shows where 100%-of-goal sits. Snap to nearest 50.

## Interaction model

- **Pointer/touch down** on the ring → begin drag (capture pointer on web;
  `PanResponder` grant on mobile).
- **Move** → compute angle of the pointer relative to the ring center; convert to a
  fraction `[0,1]` (top = 0, clockwise), then `value = clamp(round(fraction *
  scaleMax / 50) * 50, 0, scaleMax)`. Update a **local preview** value; the center
  number and the arc reflect the preview live (no network calls during drag).
- **Anti-wrap guard:** near the top boundary a small counter-clockwise move must not
  jump `0 → full`. Track the previous fraction; if a step would jump by more than
  `0.5`, clamp it to the nearer end (0 or 1).
- **Up / release** → `delta = previewValue − actualValue`. If `delta !== 0`, POST one
  entry with the delta; then refresh. Reset preview to follow server state.

## Backend (shared — one change, no DB migration)

`WaterEntry.volumeMl` and `ActivityEntry.steps` are already `Int` columns; negative
values are valid at the DB level and the day-aggregation functions already **sum**
entries, so a negative correction reduces the day total correctly.

Change only the Zod validation in `nutreluma/src/lib/validation/tracking.ts`:

- `waterEntrySchema.volumeMl`: allow negative corrections — integer in
  `[-20000, 20000]`, **must be `!== 0`** (replace the current `.min(1)`).
- `activityEntrySchema.steps`: integer in `[-200000, 200000]`, nullable/optional as
  today; the cross-field refine becomes `steps !== 0 || durationMin > 0` (was
  `> 0` only).

The client guarantees the new total never goes below 0 (preview is clamped to
`[0, scaleMax]`), so no extra server guard is required. Both web and mobile call the
same endpoints (`POST /api/water`, `POST /api/activity`), so this single change
covers both platforms.

## Web implementation

File: `nutreluma/src/components/dashboard/activity-gauges.tsx`

- Extract a **pure** helper `pointerToValue({ cx, cy, x, y, scaleMax, prevFraction })
  → value` (angle → fraction → anti-wrap → snap → clamp). Kept pure for unit testing.
- `Ring` gains an interactive mode: pointer handlers on the SVG, a visible **knob**
  (small filled circle) at the arc tip, and it renders the **preview** value while
  dragging. A faint tick marks the `target` position on the track.
- `ActivityGauges`: replace the two quick-add button groups with the interactive
  rings. On commit, call the existing `run(...)` helper to POST the delta
  (`/api/water` with `volumeMl: delta`, `/api/activity` with `kind: 'WALK', steps:
  delta`) and `router.refresh()`. Non-today renders the current read-only ring.
- The "Targets" panel (edit daily goals) is unchanged.

## Mobile implementation

Files: `nutreluma-native/src/activity-gauges.tsx`, `nutreluma-native/App.tsx`

- `WaterGauge` / `StepsGauge` accept optional `scaleMax` and `onCommit(newTotal:
  number)`; when `onCommit` is provided they become interactive.
- Add a `PanResponder` on the ring wrapper `View`. Use the same pure mapping
  (`pointerToValue`) with the touch's `locationX/locationY` relative to the ring
  center; drive an `Animated.Value`/state preview so the arc + center number update
  live. On release call `onCommit(previewTotal)`.
- `App.tsx`: pass `scaleMax = 1.5 * (target ?? default)` and `onCommit` handlers that
  compute `delta = newTotal − current` and call `api.addWater` / `api.addActivity`
  with the delta, then `load(true)`. Remove the +250/+500 and +500/+1000 button rows.
- Optional nicety: a light `expo-haptics` tick on each 50-unit snap crossing (only if
  the dependency is already available; skip otherwise).

## i18n

- Optional short hint under each gauge, e.g. "Drag to adjust". Add one key to the
  English + Greek locales if a visible hint is wanted; otherwise no i18n change.

## Testing

- Unit test the pure `pointerToValue` mapping: cardinal angles → expected fractions,
  50-snap rounding, `scaleMax` clamp, and the anti-wrap guard at the top boundary.
- Backend validation tests: `/api/water` and `/api/activity` accept a negative delta,
  reject `0`, and reject out-of-range magnitudes.

## Out of scope

- No changes to how totals are displayed elsewhere (progress page, milestones).
- No new DB columns or migrations.
- No change to the Targets (goal-editing) flow.
