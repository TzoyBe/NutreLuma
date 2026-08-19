# Interactive Radial Gauges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only water/steps dashboard rings into angular radial sliders — drag around the ring to set today's logged value (snap 50 ml / 50 steps), committing the change as a delta entry — on both web and mobile.

**Architecture:** A pure geometry module (angle→fraction→snap→anti-wrap) drives an interactive `Ring`. Web uses pointer events; mobile uses `PanResponder`. Both compute a live preview during drag and POST a single delta (may be negative) on release to the existing `/api/water` and `/api/activity` endpoints. Zod validation is relaxed to accept negative correction deltas; no DB migration (columns are already `Int`).

**Tech Stack:** Next.js 15 (React, TypeScript, SVG), Vitest (`tests/unit/**`), React Native / Expo (`react-native-svg`, `PanResponder`), Zod, Prisma.

## Global Constraints

- Web tests run with Vitest: `npm test` (config `include: ['tests/unit/**/*.test.ts']`, node env, `@` → `src`). New web tests go in `tests/unit/`.
- UNC share blocks npm; to build/test map the share to a drive first, e.g. PowerShell `net use X: \\tzoybe-nas\Container\nutreluma /persistent:no` then run npm from `X:\`. Web typecheck: `npm run typecheck`.
- Mobile (`nutreluma-native`) has **no** Vitest runner; verify mobile with `npx tsc --noEmit` from the mobile package and manual reasoning — do not add a test runner.
- Scale mapping is shared: ring fraction `0→1` maps to value `0→scaleMax`, `scaleMax = 1.5 × target`; default target when unset: water `3000` ml, steps `10000`. Snap step: water `50` ml, steps `50` steps.
- Interactivity is enabled only for `isToday`; past days stay read-only.
- Quick-add buttons (`+250/+500` water, `+500/+1000` steps) are removed on both platforms.
- Both platforms hit the same API — the single Zod change in Task 2 covers both.

---

### Task 1: Pure radial-gauge geometry (web)

Pure, dependency-free functions the interactive ring composes. Kept separate so they're unit-testable in the node Vitest env.

**Files:**
- Create: `nutreluma/src/components/dashboard/radial-gauge-math.ts`
- Test: `nutreluma/tests/unit/radial-gauge-math.test.ts`

**Interfaces:**
- Produces:
  - `angleFraction(cx: number, cy: number, x: number, y: number): number` — pointer position → fraction in `[0,1)`, where top = 0 and increases clockwise.
  - `applyAntiWrap(raw: number, prev: number | null): number` — prevents the `0↔1` jump across the top boundary; returns clamped fraction.
  - `snapValue(fraction: number, scaleMax: number, snap: number): number` — `clamp(round(fraction*scaleMax/snap)*snap, 0, scaleMax)`.

- [ ] **Step 1: Write the failing test**

```ts
// nutreluma/tests/unit/radial-gauge-math.test.ts
import { describe, expect, it } from 'vitest';
import { angleFraction, applyAntiWrap, snapValue } from '@/components/dashboard/radial-gauge-math';

describe('angleFraction', () => {
  // center at (0,0); screen coords (y grows downward)
  it('top = 0', () => expect(angleFraction(0, 0, 0, -10)).toBeCloseTo(0, 5));
  it('right = 0.25', () => expect(angleFraction(0, 0, 10, 0)).toBeCloseTo(0.25, 5));
  it('bottom = 0.5', () => expect(angleFraction(0, 0, 0, 10)).toBeCloseTo(0.5, 5));
  it('left = 0.75', () => expect(angleFraction(0, 0, -10, 0)).toBeCloseTo(0.75, 5));
});

describe('applyAntiWrap', () => {
  it('null prev returns raw', () => expect(applyAntiWrap(0.3, null)).toBe(0.3));
  it('near-full prev + near-zero raw clamps to 1', () => expect(applyAntiWrap(0.02, 0.98)).toBe(1));
  it('near-zero prev + near-full raw clamps to 0', () => expect(applyAntiWrap(0.98, 0.02)).toBe(0));
  it('small move passes through', () => expect(applyAntiWrap(0.5, 0.48)).toBe(0.5));
});

describe('snapValue', () => {
  it('half of 3000 snaps to 1500', () => expect(snapValue(0.5, 3000, 50)).toBe(1500));
  it('rounds to nearest 50', () => expect(snapValue(0.51, 100, 50)).toBe(50));
  it('clamps to scaleMax', () => expect(snapValue(0.999, 100, 50)).toBe(100));
  it('zero fraction is 0', () => expect(snapValue(0, 3000, 50)).toBe(0));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from mapped drive): `npm test -- radial-gauge-math`
Expected: FAIL — module `radial-gauge-math` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// nutreluma/src/components/dashboard/radial-gauge-math.ts

/** Pointer → fraction [0,1); top = 0, clockwise. Screen coords (y grows down). */
export function angleFraction(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx;
  const dy = y - cy;
  // atan2(dx, -dy): top→0, right→+π/2, bottom→±π, left→-π/2
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  return angle / (2 * Math.PI);
}

/** Prevent the 0↔1 jump when the pointer crosses the top boundary. */
export function applyAntiWrap(raw: number, prev: number | null): number {
  if (prev === null) return raw;
  if (Math.abs(raw - prev) > 0.5) return prev > 0.5 ? 1 : 0;
  return raw;
}

/** fraction → snapped, clamped value. */
export function snapValue(fraction: number, scaleMax: number, snap: number): number {
  const raw = fraction * scaleMax;
  const snapped = Math.round(raw / snap) * snap;
  return Math.max(0, Math.min(scaleMax, snapped));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- radial-gauge-math`
Expected: PASS (12 assertions).

- [ ] **Step 5: Commit**

```bash
git add nutreluma/src/components/dashboard/radial-gauge-math.ts nutreluma/tests/unit/radial-gauge-math.test.ts
git commit -m "feat(gauges): pure radial-gauge geometry helpers + tests"
```

---

### Task 2: Relax tracking validation for negative deltas

Allow correction deltas (may be negative, non-zero) so dragging a gauge down can post a reducing entry. Columns are already `Int`; no migration.

**Files:**
- Modify: `nutreluma/src/lib/validation/tracking.ts`
- Test: `nutreluma/tests/unit/tracking-validation.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `waterEntrySchema` accepts integer `volumeMl` in `[-20000, 20000]`, `!== 0`; `activityEntrySchema` accepts integer `steps` in `[-200000, 200000]` and passes its refine when `steps !== 0 || durationMin > 0`.

- [ ] **Step 1: Write the failing test**

```ts
// nutreluma/tests/unit/tracking-validation.test.ts
import { describe, expect, it } from 'vitest';
import { waterEntrySchema, activityEntrySchema } from '@/lib/validation/tracking';

const DATE = '2026-08-17';

describe('waterEntrySchema', () => {
  it('accepts a negative correction delta', () => {
    expect(waterEntrySchema.parse({ entryDate: DATE, volumeMl: -200 }).volumeMl).toBe(-200);
  });
  it('accepts a positive delta', () => {
    expect(waterEntrySchema.parse({ entryDate: DATE, volumeMl: 250 }).volumeMl).toBe(250);
  });
  it('rejects zero', () => {
    expect(() => waterEntrySchema.parse({ entryDate: DATE, volumeMl: 0 })).toThrow();
  });
  it('rejects out-of-range magnitude', () => {
    expect(() => waterEntrySchema.parse({ entryDate: DATE, volumeMl: 25000 })).toThrow();
  });
});

describe('activityEntrySchema', () => {
  it('accepts a negative steps delta', () => {
    expect(activityEntrySchema.parse({ entryDate: DATE, kind: 'WALK', steps: -300 }).steps).toBe(-300);
  });
  it('rejects zero steps with no duration', () => {
    expect(() => activityEntrySchema.parse({ entryDate: DATE, kind: 'WALK', steps: 0 })).toThrow();
  });
  it('rejects out-of-range steps', () => {
    expect(() => activityEntrySchema.parse({ entryDate: DATE, kind: 'WALK', steps: -300000 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tracking-validation`
Expected: FAIL — negative values currently rejected (`volumeMl.min(1)`, steps refine `> 0`).

- [ ] **Step 3: Write minimal implementation**

In `nutreluma/src/lib/validation/tracking.ts` replace the `volumeMl` field:

```ts
  volumeMl: z.coerce
    .number({ invalid_type_error: 'Η ποσότητα πρέπει να είναι αριθμός.' })
    .int('Ακέραιος αριθμός ml.')
    .min(-20000, 'Μη ρεαλιστική ποσότητα.')
    .max(20000, 'Μη ρεαλιστική ποσότητα.')
    .refine((v) => v !== 0, 'Δώσε μη μηδενική ποσότητα.'),
```

Replace the `steps` field and the cross-field refine in `activityEntrySchema`:

```ts
    steps: z.coerce.number().int().min(-200000).max(200000).nullable().optional(),
```
```ts
  .refine((d) => (d.steps ?? 0) !== 0 || (d.durationMin ?? 0) > 0, {
    message: 'Δώσε βήματα ή διάρκεια.',
    path: ['steps'],
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tracking-validation`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add nutreluma/src/lib/validation/tracking.ts nutreluma/tests/unit/tracking-validation.test.ts
git commit -m "feat(tracking): accept negative correction deltas for water/steps"
```

---

### Task 3: Interactive gauges on the web dashboard

Replace the read-only rings + quick-add buttons with draggable radial sliders. Commit a delta on release.

**Files:**
- Modify: `nutreluma/src/components/dashboard/activity-gauges.tsx`

**Interfaces:**
- Consumes: `angleFraction`, `applyAntiWrap`, `snapValue` from Task 1; `POST /api/water` (`{ entryDate, volumeMl }`) and `POST /api/activity` (`{ entryDate, kind: 'WALK', steps }`) accepting deltas from Task 2.
- Produces: no new exports (same `ActivityGauges` component signature).

- [ ] **Step 1: Rewrite the `Ring` to support an interactive mode**

Give `Ring` optional interactive props and a live preview. Keep the existing read-only path when `interactive` is false. Replace the `Ring` component with:

```tsx
function Ring({
  value,
  scaleMax,
  target,
  from,
  to,
  interactive,
  onCommit,
  children,
}: {
  value: number;            // committed value (consumed)
  scaleMax: number;         // value at fraction 1 (1.5 × target)
  target: number;           // 100%-of-goal marker position
  from: string;
  to: string;
  interactive: boolean;
  onCommit?: (newValue: number) => void;
  children: (displayValue: number) => React.ReactNode;
}) {
  const gid = React.useId();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const prevFraction = React.useRef<number | null>(null);
  const [preview, setPreview] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const display = preview ?? value;
  const fraction = Math.max(0, Math.min(1, display / scaleMax));
  const offset = C * (1 - fraction);
  const targetFraction = Math.max(0, Math.min(1, target / scaleMax));

  // knob position (arc starts at top, clockwise) — SVG is rotated -90°, so the
  // painted angle for a fraction f is (f*360 - 90) degrees.
  const knobAngle = (fraction * 360 - 90) * (Math.PI / 180);
  const knobX = SIZE / 2 + R * Math.cos(knobAngle);
  const knobY = SIZE / 2 + R * Math.sin(knobAngle);
  // target tick position
  const tickAngle = (targetFraction * 360 - 90) * (Math.PI / 180);
  const tickX1 = SIZE / 2 + (R - STROKE / 2) * Math.cos(tickAngle);
  const tickY1 = SIZE / 2 + (R - STROKE / 2) * Math.sin(tickAngle);
  const tickX2 = SIZE / 2 + (R + STROKE / 2) * Math.cos(tickAngle);
  const tickY2 = SIZE / 2 + (R + STROKE / 2) * Math.sin(tickAngle);

  const updateFromEvent = React.useCallback(
    (e: React.PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const raw = angleFraction(cx, cy, e.clientX, e.clientY);
      const f = applyAntiWrap(raw, prevFraction.current);
      prevFraction.current = f;
      setPreview(snapValue(f, scaleMax, SNAP));
    },
    [scaleMax],
  );

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        className={`-rotate-90 ${interactive ? 'cursor-pointer touch-none' : ''}`}
        onPointerDown={
          interactive
            ? (e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDragging(true);
                prevFraction.current = Math.max(0, Math.min(1, value / scaleMax));
                updateFromEvent(e);
              }
            : undefined
        }
        onPointerMove={interactive && dragging ? updateFromEvent : undefined}
        onPointerUp={
          interactive
            ? () => {
                setDragging(false);
                const next = preview;
                prevFraction.current = null;
                setPreview(null);
                if (next != null && next !== value) onCommit?.(next);
              }
            : undefined
        }
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth={STROKE} opacity={0.6} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={dragging ? undefined : { transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
        {interactive ? (
          <>
            <line x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2} stroke="hsl(var(--foreground))" strokeWidth={2} opacity={0.35} />
            <circle cx={knobX} cy={knobY} r={STROKE / 2 + 2} fill="white" stroke={to} strokeWidth={2} />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children(Math.round(display))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the `SNAP` constant and imports**

Near the top constants add `const SNAP = 50;` and import the math helpers:

```tsx
import { angleFraction, applyAntiWrap, snapValue } from './radial-gauge-math';
```

- [ ] **Step 3: Wire commit handlers and compute scaleMax in `ActivityGauges`**

Add delta-committing helpers (reuse the existing `run`) and scale maxima. Insert after the existing `addWater`/`addSteps` (which are now removed — see Step 4):

```tsx
  const WATER_DEFAULT = 3000;
  const STEPS_DEFAULT = 10000;
  const waterScaleMax = 1.5 * (waterTarget ?? WATER_DEFAULT);
  const stepsScaleMax = 1.5 * (goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_DEFAULT);

  const commitWater = (newTotal: number) => {
    const delta = Math.round(newTotal - waterMl);
    if (delta === 0) return;
    run('water-commit', () => api.post('/api/water', { entryDate: date, volumeMl: delta }));
  };
  const commitSteps = (newTotal: number) => {
    const delta = Math.round(newTotal - steps);
    if (delta === 0) return;
    run('steps-commit', () => api.post('/api/activity', { entryDate: date, kind: 'WALK', steps: delta }));
  };
```

- [ ] **Step 4: Replace the two gauge blocks (remove quick-add buttons)**

Water block:

```tsx
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/40 p-4">
          <Ring
            value={waterMl}
            scaleMax={waterScaleMax}
            target={waterTarget ?? WATER_DEFAULT}
            from="#38BDF8"
            to="#2563EB"
            interactive={isToday}
            onCommit={commitWater}
          >
            {(display) => (
              <>
                <Droplet className="h-4 w-4 text-sky-400" aria-hidden="true" />
                <span className="text-2xl font-bold tabular-nums">{display.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {waterTarget ? `of ${waterTarget.toLocaleString()} ml` : 'ml'}
                </span>
              </>
            )}
          </Ring>
          <p className="text-sm font-semibold">{t('dashboard.water')}</p>
          {isToday ? <p className="text-[11px] text-muted-foreground">{t('dashboard.dragToAdjust')}</p> : null}
        </div>
```

Steps block:

```tsx
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/40 p-4">
          <Ring
            value={steps}
            scaleMax={stepsScaleMax}
            target={goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_FALLBACK}
            from="#2DD4BF"
            to="#10B981"
            interactive={isToday}
            onCommit={commitSteps}
          >
            {(display) => (
              <>
                <Footprints className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span className="text-2xl font-bold tabular-nums">{display.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">of {stepsTarget.toLocaleString()}</span>
              </>
            )}
          </Ring>
          <p className="text-sm font-semibold">{t('dashboard.steps')}</p>
          {isToday ? <p className="text-[11px] text-muted-foreground">{t('dashboard.dragToAdjust')}</p> : null}
        </div>
```

Delete the now-unused `addWater`/`addSteps` functions and the `Plus` import if no longer referenced. Keep the `Targets` panel unchanged.

- [ ] **Step 5: Add the `dragToAdjust` i18n key (English + Greek)**

Find the locale files (search for the existing key `dashboard.targets`) and add a sibling `dragToAdjust`. English: `"Drag the ring to adjust"`. Greek: `"Σύρε το δαχτυλίδι για ρύθμιση"`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Fix any type mismatch (e.g. the `children` render-prop signature).

- [ ] **Step 7: Commit**

```bash
git add nutreluma/src/components/dashboard/activity-gauges.tsx nutreluma/src/i18n
git commit -m "feat(web): interactive radial water/steps gauges with drag-to-log"
```

---

### Task 4: Interactive gauges on mobile

Duplicate the pure math (separate package) and make `WaterGauge`/`StepsGauge` draggable via `PanResponder`; wire `App.tsx` to post deltas and drop the quick-add rows.

**Files:**
- Create: `nutreluma-native/src/radial-gauge-math.ts`
- Modify: `nutreluma-native/src/activity-gauges.tsx`
- Modify: `nutreluma-native/App.tsx` (gauge render block ~5310–5355; `addWater`/`addSteps` ~5077, ~5135)

**Interfaces:**
- Consumes: `POST /api/water` / `POST /api/activity` delta support (Task 2), reached via existing `api.addWater` / `api.addActivity`.
- Produces: `WaterGauge` / `StepsGauge` gain optional props `scaleMax?: number` and `onCommit?: (newTotal: number) => void`; interactive when `onCommit` is set.

- [ ] **Step 1: Create the mobile math module (identical logic to web)**

```ts
// nutreluma-native/src/radial-gauge-math.ts
export function angleFraction(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx;
  const dy = y - cy;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  return angle / (2 * Math.PI);
}
export function applyAntiWrap(raw: number, prev: number | null): number {
  if (prev === null) return raw;
  if (Math.abs(raw - prev) > 0.5) return prev > 0.5 ? 1 : 0;
  return raw;
}
export function snapValue(fraction: number, scaleMax: number, snap: number): number {
  const snapped = Math.round((fraction * scaleMax) / snap) * snap;
  return Math.max(0, Math.min(scaleMax, snapped));
}
```

- [ ] **Step 2: Make `Ring` interactive in `activity-gauges.tsx`**

Add a `SNAP = 50` const and, in `Ring`, accept `interactive`, `scaleMax`, `value`, `target`, `onCommit`. Attach a `PanResponder` to a wrapping `View` (add `import { PanResponder, View } from 'react-native'` — `View` is already imported). Drive the existing `anim` value from the live preview and expose the preview number to the parent via a render callback or a `preview` state lifted through props. Minimal approach — keep the numeric readout owned by the gauge:

```tsx
// inside activity-gauges.tsx
import { PanResponder } from 'react-native';
import { angleFraction, applyAntiWrap, snapValue } from './radial-gauge-math';
const SNAP = 50;
```

Refactor `WaterGauge` (and mirror for `StepsGauge`) to manage a preview and a PanResponder over the ring wrapper:

```tsx
export function WaterGauge({
  consumedMl,
  targetMl,
  scaleMax,
  onCommit,
}: {
  consumedMl: number;
  targetMl: number | null;
  scaleMax?: number;
  onCommit?: (newTotal: number) => void;
}) {
  const target = targetMl && targetMl > 0 ? targetMl : null;
  const max = scaleMax ?? 1.5 * (target ?? 3000);
  const interactive = !!onCommit;
  const [preview, setPreview] = React.useState<number | null>(null);
  const prev = React.useRef<number | null>(null);
  const display = preview ?? consumedMl;
  const fraction = max > 0 ? display / max : 0;

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: () => interactive,
        onPanResponderGrant: () => {
          prev.current = Math.max(0, Math.min(1, consumedMl / max));
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const raw = angleFraction(SIZE / 2, SIZE / 2, locationX, locationY);
          const f = applyAntiWrap(raw, prev.current);
          prev.current = f;
          setPreview(snapValue(f, max, SNAP));
        },
        onPanResponderRelease: () => {
          const next = preview;
          prev.current = null;
          setPreview(null);
          if (next != null && next !== consumedMl) onCommit?.(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interactive, max, consumedMl, preview],
  );

  return (
    <View style={styles.wrap}>
      <View style={{ width: SIZE, height: SIZE }} {...(interactive ? pan.panHandlers : {})}>
        <Ring fraction={fraction} from="#38BDF8" to="#2563EB" glow="#38BDF8" uid="water" />
        <View style={styles.center} pointerEvents="none">
          <Droplet size={18} color="#38BDF8" />
          <Text style={styles.value}>{Math.round(display).toLocaleString()}</Text>
          <Text style={styles.caption}>{target ? `of ${target.toLocaleString()} ml` : 'ml today'}</Text>
        </View>
      </View>
      <Text style={styles.label}>Water{target ? ` · ${pct(display, target)}%` : ''}</Text>
    </View>
  );
}
```

Add `import * as React from 'react';` if not present (file currently imports named hooks from `'react'`; add `useMemo`, `useRef`, `useState` to that import or switch to the namespace import). Mirror the same changes for `StepsGauge` with `steps`/`targetSteps`, colors `#2DD4BF`/`#10B981`, default `10000`, label `Steps`.

- [ ] **Step 3: Wire commit handlers in `App.tsx` and remove quick-add rows**

Add delta-committing functions near `addWater`/`addSteps`:

```tsx
  async function commitWater(newTotal: number) {
    const delta = Math.round(newTotal - waterMl);
    if (delta === 0 || addingWater) return;
    setAddingWater(true);
    setError(null);
    try {
      await api.addWater(session.token, { entryDate: date, volumeMl: delta });
      await load(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setAddingWater(false);
    }
  }
  async function commitSteps(newTotal: number) {
    const delta = Math.round(newTotal - steps);
    if (delta === 0 || addingSteps) return;
    setAddingSteps(true);
    setError(null);
    try {
      await api.addActivity(session.token, { entryDate: date, kind: 'WALK', steps: delta });
      await load(true);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setAddingSteps(false);
    }
  }
```

Replace the gauge render block (~5310–5355) so the gauges are interactive and the `waterAddRow` button `View`s are removed:

```tsx
      <View style={styles.macroGaugeGrid}>
        <GlassCard style={styles.macroGaugeCard}>
          <WaterGauge
            consumedMl={waterMl}
            targetMl={waterTarget}
            scaleMax={1.5 * (waterTarget ?? 3000)}
            onCommit={isToday ? commitWater : undefined}
          />
        </GlassCard>
        <GlassCard style={styles.macroGaugeCard}>
          <StepsGauge
            steps={steps}
            targetSteps={stepsTarget ?? STEPS_FALLBACK}
            scaleMax={1.5 * (stepsTarget ?? STEPS_FALLBACK)}
            onCommit={isToday ? commitSteps : undefined}
          />
        </GlassCard>
      </View>
```

Remove the now-unused `addWater`/`addSteps` functions and the `Plus` import if unreferenced elsewhere. Leave `waterAddRow`/`waterAddButton*` styles in place (harmless) or delete if unused.

- [ ] **Step 4: Typecheck mobile**

Run from `nutreluma-native`: `npx tsc --noEmit`
Expected: no errors. Resolve any (e.g. React import style, `pct` accepting `display`).

- [ ] **Step 5: Commit**

```bash
git add nutreluma-native/src/radial-gauge-math.ts nutreluma-native/src/activity-gauges.tsx nutreluma-native/App.tsx
git commit -m "feat(mobile): interactive radial water/steps gauges with drag-to-log"
```

---

## Self-Review

- **Spec coverage:** decisions 1–5 → Tasks 3/4 (consumed value, angular drag, drag-only) + Task 2 (negative delta) + scaleMax 1.5× (Tasks 3/4). Backend change → Task 2. Web → Task 3. Mobile → Task 4. Pure mapping + tests → Task 1. Backend validation tests → Task 2. i18n hint → Task 3 Step 5. All covered.
- **Placeholder scan:** no TBD/TODO; all code blocks concrete.
- **Type consistency:** `angleFraction`/`applyAntiWrap`/`snapValue` signatures identical in Tasks 1 and 4; `onCommit(newTotal: number)` consistent web↔mobile; delta = `newTotal − current` in both.
- **Note for executor:** confirm the exact i18n locale file paths (search `dashboard.targets`) before Task 3 Step 5; confirm mobile `react` import style before Task 4 Step 2.
