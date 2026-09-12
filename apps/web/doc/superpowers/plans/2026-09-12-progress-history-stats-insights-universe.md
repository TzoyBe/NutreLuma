# Progress / History / Stats / Insights Universe Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Progress, History, Stats, and Insights (web + native) onto the existing "universe" hero visual language (orbital ring, big hero number, 3 tone-coded satellites) already used by Recipes/Profile/Goals, without touching any existing chart/filter/list functionality.

**Architecture:** Each page gets a pure `build{Page}Universe(input)` model function (web: TS module per page under its `components/{page}/` dir; native: added to the existing shared `apps/native/src/personal-universe-model.ts`) plus a presentational hero component reusing the existing generic `universe-app-hero`/`universe-app-reveal`/`universe-app-orbit` CSS classes (web) or the existing `<UniverseHero>`/`<UniverseMetric>`/`<UniverseActionTile>` components (native, already generic — no new native UI primitives needed). One new backend endpoint (`GET /api/history-totals`) is added because native's History/Progress screens have no existing way to fetch day/week/month kcal totals (web already computes this server-side via a function not exposed over HTTP).

**Tech Stack:** Next.js 16 (web, App Router, Tailwind v4), Expo/React Native 57 (native), vitest (both), Prisma/PostgreSQL (unchanged).

## Global Constraints

- Follow the spec exactly: `apps/web/doc/superpowers/specs/2026-09-12-progress-history-stats-insights-universe-design.md`.
- No changes to existing chart/filter/list behavior on any of the 4 pages — only the new hero is added above them.
- No new Prisma models or migrations.
- Reuse existing i18n keys on web (all needed strings already exist — verified during planning); do not add new translation keys.
- Native has no i18n layer — hardcode English label strings in native model functions, matching the existing `buildNativeGoalUniverse`/`buildNativeProfileUniverse` convention.
- Every new pure function gets a vitest unit test before being wired into a page/screen (TDD: write the failing test first).
- Commit after every task; push after every commit (per this project's standing convention).
- Run `npm run typecheck` (native) or `npx tsc --noEmit` / `npm run build -- --webpack` (web) before committing each task that touches TypeScript.

---

### Task 1: Web shared CSS + Stats page

**Files:**
- Modify: `apps/web/src/app/globals.css` (add a new, fully self-contained CSS block — do not touch existing `.goals-universe`/`.recipes-universe` rules)
- Create: `apps/web/src/components/stats/stats-universe-model.ts`
- Create: `apps/web/src/components/stats/stats-universe.tsx`
- Modify: `apps/web/src/app/(app)/stats/page.tsx`
- Test: `apps/web/tests/unit/stats-universe-model.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2, 3, 5 — same CSS classes, no JS import needed): CSS classes `.universe-hero-orbit`, `.universe-hero-orbit-center`, `.universe-hero-satellite` (+ `[data-tone='cyan'|'gold'|'violet']`), `.universe-hero-satellite-label`, `.universe-hero-satellite-value`.
- Produces: `StatsUniverseInput`, `StatsUniverseModel`, `buildStatsUniverseModel(input): StatsUniverseModel` from `stats-universe-model.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/unit/stats-universe-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildStatsUniverseModel } from '@/components/stats/stats-universe-model';

describe('buildStatsUniverseModel', () => {
  it('rounds averages and formats the within-target percent', () => {
    expect(
      buildStatsUniverseModel({
        average7: 2103.6,
        average30: 1987.2,
        weekTotal: 14725,
        daysWithinTargetPercent: 71,
      }),
    ).toEqual({
      hero: 2104,
      satellites: [
        { key: 'average30', value: 1987, unit: 'kcal', tone: 'cyan' },
        { key: 'weekTotal', value: 14725, unit: 'kcal', tone: 'gold' },
        { key: 'daysWithinTarget', value: 71, unit: '%', tone: 'violet' },
      ],
    });
  });

  it('falls back to "--" with no unit when the within-target percent is null', () => {
    const model = buildStatsUniverseModel({
      average7: 0,
      average30: 0,
      weekTotal: 0,
      daysWithinTargetPercent: null,
    });
    expect(model.satellites[2]).toEqual({
      key: 'daysWithinTarget',
      value: '--',
      unit: undefined,
      tone: 'violet',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Map the share to a drive letter first (UNC paths break `npx`/`npm`):
```
net use X: \\tzoybe-nas\Container\nutreluma
cd X:\apps\web
npx vitest run tests/unit/stats-universe-model.test.ts
```
Expected: FAIL — `Cannot find module '@/components/stats/stats-universe-model'`.

- [ ] **Step 3: Write the model**

Create `apps/web/src/components/stats/stats-universe-model.ts`:

```ts
export interface StatsUniverseInput {
  average7: number;
  average30: number;
  weekTotal: number;
  daysWithinTargetPercent: number | null;
}

export interface StatsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'average30' | 'weekTotal' | 'daysWithinTarget';
    value: number | string;
    unit?: 'kcal' | '%';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
}

export function buildStatsUniverseModel(input: StatsUniverseInput): StatsUniverseModel {
  return {
    hero: Math.round(input.average7),
    satellites: [
      { key: 'average30', value: Math.round(input.average30), unit: 'kcal', tone: 'cyan' },
      { key: 'weekTotal', value: Math.round(input.weekTotal), unit: 'kcal', tone: 'gold' },
      {
        key: 'daysWithinTarget',
        value: input.daysWithinTargetPercent ?? '--',
        unit: input.daysWithinTargetPercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/stats-universe-model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the shared CSS block**

In `apps/web/src/app/globals.css`, immediately after the existing block ending `.goals-universe-macro-value > span, .recipes-universe-macro-value > span { margin-inline-start: 0.2rem; font-size: 0.75rem; }` and its `@media (max-width: 400px)` rule (search for `.recipes-universe-macro-value > span`), insert a new block:

```css
/* ---------- Personal Universe: generic hero (Progress/History/Stats/Insights) ---------- */
.universe-hero-orbit {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(0.5rem, 2vw, 1.5rem);
  justify-items: center;
  padding: clamp(1.25rem, 4vw, 2.5rem);
}
.universe-hero-orbit.glass-specular::before { display: none; }

.universe-hero-orbit-center {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: clamp(8rem, 24vw, 12rem);
  aspect-ratio: 1;
  margin-block: 0.75rem 1.25rem;
  border-radius: 50%;
  border: 1px solid hsl(var(--glass-border) / 0.35);
  background:
    radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.24), transparent 70%),
    hsl(var(--glass-bg) / 0.98);
  box-shadow: inset 0 1px 0 hsl(var(--liquid-edge) / 0.35), 0 0 36px -20px hsl(var(--primary) / 0.7);
}
.universe-hero-orbit-center > :first-child {
  font-family: var(--font-sora), var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(2rem, 6vw, 3.5rem);
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
}
.universe-hero-orbit-center > :last-child,
.universe-hero-satellite-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.universe-hero-satellite {
  --macro-color: var(--nutrition-protein);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  min-width: 0;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--macro-color) / 0.48);
  text-align: center;
  overflow-wrap: anywhere;
}
.universe-hero-satellite[data-tone='gold'] { --macro-color: var(--nutrition-carbs); }
.universe-hero-satellite[data-tone='violet'] { --macro-color: var(--nutrition-fat); }
.universe-hero-satellite-value {
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.universe-hero-satellite-value > span { margin-inline-start: 0.2rem; font-size: 0.75rem; }
@media (max-width: 400px) {
  .universe-hero-orbit { grid-template-columns: 1fr 1.4fr 1fr; }
  .universe-hero-satellite-label { min-height: 2.5em; text-wrap: balance; }
}
```

- [ ] **Step 6: Write the component**

Create `apps/web/src/components/stats/stats-universe.tsx`:

```tsx
import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { StatsUniverseModel } from './stats-universe-model';

export function StatsUniverse({
  model,
  title,
  heroLabel,
  labels,
}: {
  model: StatsUniverseModel;
  title: string;
  heroLabel: string;
  labels: Record<'average30' | 'weekTotal' | 'daysWithinTarget', string>;
}): React.ReactElement {
  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="stats-universe-title">
        <h2 id="stats-universe-title" className="sr-only">{title}</h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="universe-hero-orbit-center">
          <span>{model.hero}</span>
          <span>{heroLabel}</span>
        </div>
        {model.satellites.map((satellite) => (
          <div key={satellite.key} className="universe-hero-satellite" data-tone={satellite.tone}>
            <span className="universe-hero-satellite-label">{labels[satellite.key]}</span>
            <span className="universe-hero-satellite-value">
              {satellite.value}
              {satellite.unit ? <span>{satellite.unit}</span> : null}
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
```

- [ ] **Step 7: Wire it into the Stats page**

In `apps/web/src/app/(app)/stats/page.tsx`:
- Add imports: `import { StatsUniverse } from '@/components/stats/stats-universe';` and `import { buildStatsUniverseModel } from '@/components/stats/stats-universe-model';`
- Immediately after `const stats = await getStatsOverview(user.id, days);` add:
  ```ts
  const universeModel = buildStatsUniverseModel({
    average7: stats.average7,
    average30: stats.average30,
    weekTotal: stats.weekTotal,
    daysWithinTargetPercent: stats.daysWithinTargetPercent,
  });
  ```
- Inside the `{stats.daysLogged === 0 ? (...) : (<>...` populated branch, as the very first child of the `<>` (before the existing `<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">` StatTile row), add:
  ```tsx
  <StatsUniverse
    model={universeModel}
    title={t('stats.title')}
    heroLabel={t('stats.avg7')}
    labels={{
      average30: t('stats.avg30'),
      weekTotal: t('history.weekTotal'),
      daysWithinTarget: t('stats.daysWithinTarget'),
    }}
  />
  ```
  (Leave the existing `StatTile` row and every other section below it exactly as-is.)

- [ ] **Step 8: Typecheck and build**

```
cd X:\apps\web
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed with no errors.

- [ ] **Step 9: Visual check**

Run `npm run dev` (or use the `run` skill), log in, open `/stats`, confirm the new hero card renders above the existing 4-tile row with no layout break, and the rest of the page (heatmap, charts, distributions) is unchanged.

- [ ] **Step 10: Commit and push**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/stats/stats-universe-model.ts apps/web/src/components/stats/stats-universe.tsx "apps/web/src/app/(app)/stats/page.tsx" apps/web/tests/unit/stats-universe-model.test.ts
git commit -m "feat(web): add universe hero to Stats page"
git push
```

---

### Task 2: Web History page

**Files:**
- Create: `apps/web/src/components/history/history-universe-model.ts`
- Create: `apps/web/src/components/history/history-universe.tsx`
- Modify: `apps/web/src/app/(app)/history/page.tsx`
- Test: `apps/web/tests/unit/history-universe-model.test.ts`

**Interfaces:**
- Consumes: `.universe-hero-orbit` / `.universe-hero-orbit-center` / `.universe-hero-satellite*` CSS classes from Task 1.
- Produces: `HistoryUniverseInput`, `HistoryUniverseModel`, `buildHistoryUniverseModel(input)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/unit/history-universe-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildHistoryUniverseModel } from '@/components/history/history-universe-model';

describe('buildHistoryUniverseModel', () => {
  it('rounds each kcal total', () => {
    expect(
      buildHistoryUniverseModel({
        dayTotal: 1842.4,
        weekTotal: 12903.9,
        weekAverage: 1843.4,
        monthAverage: 1901.1,
      }),
    ).toEqual({
      hero: 1842,
      satellites: [
        { key: 'weekTotal', value: 12904, unit: 'kcal', tone: 'cyan' },
        { key: 'weekAverage', value: 1843, unit: 'kcal', tone: 'gold' },
        { key: 'monthAverage', value: 1901, unit: 'kcal', tone: 'violet' },
      ],
    });
  });

  it('handles an all-zero day with no meals logged', () => {
    expect(
      buildHistoryUniverseModel({ dayTotal: 0, weekTotal: 0, weekAverage: 0, monthAverage: 0 }),
    ).toEqual({
      hero: 0,
      satellites: [
        { key: 'weekTotal', value: 0, unit: 'kcal', tone: 'cyan' },
        { key: 'weekAverage', value: 0, unit: 'kcal', tone: 'gold' },
        { key: 'monthAverage', value: 0, unit: 'kcal', tone: 'violet' },
      ],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd X:\apps\web && npx vitest run tests/unit/history-universe-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the model**

Create `apps/web/src/components/history/history-universe-model.ts`:

```ts
export interface HistoryUniverseInput {
  dayTotal: number;
  weekTotal: number;
  weekAverage: number;
  monthAverage: number;
}

export interface HistoryUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'weekTotal' | 'weekAverage' | 'monthAverage';
    value: number;
    unit: 'kcal';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
}

export function buildHistoryUniverseModel(input: HistoryUniverseInput): HistoryUniverseModel {
  return {
    hero: Math.round(input.dayTotal),
    satellites: [
      { key: 'weekTotal', value: Math.round(input.weekTotal), unit: 'kcal', tone: 'cyan' },
      { key: 'weekAverage', value: Math.round(input.weekAverage), unit: 'kcal', tone: 'gold' },
      { key: 'monthAverage', value: Math.round(input.monthAverage), unit: 'kcal', tone: 'violet' },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/history-universe-model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the component**

Create `apps/web/src/components/history/history-universe.tsx` (identical structure to `stats-universe.tsx`, retyped):

```tsx
import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { HistoryUniverseModel } from './history-universe-model';

export function HistoryUniverse({
  model,
  title,
  heroLabel,
  labels,
}: {
  model: HistoryUniverseModel;
  title: string;
  heroLabel: string;
  labels: Record<'weekTotal' | 'weekAverage' | 'monthAverage', string>;
}): React.ReactElement {
  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="history-universe-title">
        <h2 id="history-universe-title" className="sr-only">{title}</h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="universe-hero-orbit-center">
          <span>{model.hero}</span>
          <span>{heroLabel}</span>
        </div>
        {model.satellites.map((satellite) => (
          <div key={satellite.key} className="universe-hero-satellite" data-tone={satellite.tone}>
            <span className="universe-hero-satellite-label">{labels[satellite.key]}</span>
            <span className="universe-hero-satellite-value">
              {satellite.value}
              <span>{satellite.unit}</span>
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
```

- [ ] **Step 6: Wire it into the History page**

In `apps/web/src/app/(app)/history/page.tsx`:
- Add imports: `import { HistoryUniverse } from '@/components/history/history-universe';` and `import { buildHistoryUniverseModel } from '@/components/history/history-universe-model';`
- After `const [{ meals, total, page, pageSize }, totals] = await Promise.all([...]);` add:
  ```ts
  const universeModel = buildHistoryUniverseModel(totals);
  ```
- Immediately before the existing `<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">` (the 4 `StatTile`s), insert:
  ```tsx
  <HistoryUniverse
    model={universeModel}
    title={t('history.title')}
    heroLabel={t('history.dayTotal')}
    labels={{
      weekTotal: t('history.weekTotal'),
      weekAverage: t('history.weekAverage'),
      monthAverage: t('history.monthAverage'),
    }}
  />
  ```

- [ ] **Step 7: Typecheck and build**

```
cd X:\apps\web
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed.

- [ ] **Step 8: Visual check**

Open `/history`, confirm the hero renders above the existing 4-tile row, filters and meal list unchanged.

- [ ] **Step 9: Commit and push**

```bash
git add apps/web/src/components/history/history-universe-model.ts apps/web/src/components/history/history-universe.tsx "apps/web/src/app/(app)/history/page.tsx" apps/web/tests/unit/history-universe-model.test.ts
git commit -m "feat(web): add universe hero to History page"
git push
```

---

### Task 3: Web Insights page

**Files:**
- Create: `apps/web/src/components/insights/insights-universe-model.ts`
- Create: `apps/web/src/components/insights/insights-universe.tsx`
- Modify: `apps/web/src/app/(app)/insights/page.tsx`
- Test: `apps/web/tests/unit/insights-universe-model.test.ts`

**Interfaces:**
- Consumes: CSS classes from Task 1.
- Produces: `InsightsUniverseInput`, `InsightsUniverseModel`, `buildInsightsUniverseModel(input)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/unit/insights-universe-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildInsightsUniverseModel } from '@/components/insights/insights-universe-model';

describe('buildInsightsUniverseModel', () => {
  it('builds the hero and all three satellites when energy data exists', () => {
    expect(
      buildInsightsUniverseModel({
        calibrationScore: 82,
        qualityScore: 64,
        correctionRate30d: 12,
        energyConfidencePercent: 71,
      }),
    ).toEqual({
      hero: 82,
      satellites: [
        { key: 'dataConfidence', value: 64, unit: '%', tone: 'cyan' },
        { key: 'correctionRate', value: 12, unit: '%', tone: 'gold' },
        { key: 'energyConfidence', value: 71, unit: '%', tone: 'violet' },
      ],
    });
  });

  it('falls back to "--" with no unit when quality or energy data is missing', () => {
    const model = buildInsightsUniverseModel({
      calibrationScore: 0,
      qualityScore: null,
      correctionRate30d: 0,
      energyConfidencePercent: null,
    });
    expect(model.satellites[0]).toEqual({ key: 'dataConfidence', value: '--', unit: undefined, tone: 'cyan' });
    expect(model.satellites[2]).toEqual({ key: 'energyConfidence', value: '--', unit: undefined, tone: 'violet' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd X:\apps\web && npx vitest run tests/unit/insights-universe-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the model**

Create `apps/web/src/components/insights/insights-universe-model.ts`:

```ts
export interface InsightsUniverseInput {
  calibrationScore: number;
  qualityScore: number | null;
  correctionRate30d: number;
  energyConfidencePercent: number | null;
}

export interface InsightsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'dataConfidence' | 'correctionRate' | 'energyConfidence';
    value: number | string;
    unit?: '%';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
}

export function buildInsightsUniverseModel(input: InsightsUniverseInput): InsightsUniverseModel {
  return {
    hero: input.calibrationScore,
    satellites: [
      {
        key: 'dataConfidence',
        value: input.qualityScore ?? '--',
        unit: input.qualityScore === null ? undefined : '%',
        tone: 'cyan',
      },
      { key: 'correctionRate', value: input.correctionRate30d, unit: '%', tone: 'gold' },
      {
        key: 'energyConfidence',
        value: input.energyConfidencePercent ?? '--',
        unit: input.energyConfidencePercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/insights-universe-model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the component**

Create `apps/web/src/components/insights/insights-universe.tsx` (same structure again):

```tsx
import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { InsightsUniverseModel } from './insights-universe-model';

export function InsightsUniverse({
  model,
  title,
  heroLabel,
  labels,
}: {
  model: InsightsUniverseModel;
  title: string;
  heroLabel: string;
  labels: Record<'dataConfidence' | 'correctionRate' | 'energyConfidence', string>;
}): React.ReactElement {
  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="insights-universe-title">
        <h2 id="insights-universe-title" className="sr-only">{title}</h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="universe-hero-orbit-center">
          <span>{model.hero}%</span>
          <span>{heroLabel}</span>
        </div>
        {model.satellites.map((satellite) => (
          <div key={satellite.key} className="universe-hero-satellite" data-tone={satellite.tone}>
            <span className="universe-hero-satellite-label">{labels[satellite.key]}</span>
            <span className="universe-hero-satellite-value">
              {satellite.value}
              {satellite.unit ? <span>{satellite.unit}</span> : null}
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
```

- [ ] **Step 6: Wire it into the Insights page**

In `apps/web/src/app/(app)/insights/page.tsx`:
- Add imports: `import { InsightsUniverse } from '@/components/insights/insights-universe';` and `import { buildInsightsUniverseModel } from '@/components/insights/insights-universe-model';`
- After the existing `const [calibration, rates, quality, patterns, energy, settings] = await Promise.all([...]);` add:
  ```ts
  const universeModel = buildInsightsUniverseModel({
    calibrationScore: calibration.score,
    qualityScore: quality?.score ?? null,
    correctionRate30d: rates['30d'],
    energyConfidencePercent: energy ? Math.round(energy.confidence * 100) : null,
  });
  ```
- Immediately before the existing `<div className="grid gap-3 sm:grid-cols-3">` (the 3 `Metric` cards), insert:
  ```tsx
  <InsightsUniverse
    model={universeModel}
    title={t('insights.title')}
    heroLabel={t('insights.calibration')}
    labels={{
      dataConfidence: t('insights.dataConfidence'),
      correctionRate: t('insights.correctionRate'),
      energyConfidence: t('insights.confidence'),
    }}
  />
  ```

- [ ] **Step 7: Typecheck and build**

```
cd X:\apps\web
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed.

- [ ] **Step 8: Visual check**

Open `/insights`, confirm hero renders above the existing 3 Metric cards, energy card and patterns list unchanged.

- [ ] **Step 9: Commit and push**

```bash
git add apps/web/src/components/insights/insights-universe-model.ts apps/web/src/components/insights/insights-universe.tsx "apps/web/src/app/(app)/insights/page.tsx" apps/web/tests/unit/insights-universe-model.test.ts
git commit -m "feat(web): add universe hero to Insights page"
git push
```

---

### Task 4: New `/api/history-totals` endpoint (needed by native)

**Files:**
- Create: `apps/web/src/app/api/history-totals/route.ts`
- Modify: `apps/native/src/api.ts`

**Interfaces:**
- Produces: `GET /api/history-totals?date=YYYY-MM-DD` (date optional, defaults to today in the user's timezone) → `{ dayTotal, weekTotal, weekAverage, monthTotal, monthAverage, target }` (same shape `getHistoryTotals` already returns).
- Produces (native): `api.historyTotals(token, date?)` and `HistoryTotalsResult` type, consumed by Tasks 8 and 10.

- [ ] **Step 1: Write the route**

Create `apps/web/src/app/api/history-totals/route.ts`:

```ts
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getUserTimezone } from '@/server/services/profile';
import { getGoalForDay } from '@/server/services/goals';
import { getHistoryTotals } from '@/server/services/stats';
import { dayQuerySchema } from '@/lib/validation/meal';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const url = new URL(request.url);
  const { date } = dayQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

  const timezone = await getUserTimezone(user.id);
  const dayISO = date ?? todayISO(timezone);
  const target = (await getGoalForDay(user.id, dayISO)).calorieTarget;

  return jsonOk(await getHistoryTotals(user.id, dayISO, timezone, target));
});
```

- [ ] **Step 2: Typecheck**

```
cd X:\apps\web
npx tsc --noEmit
```
Expected: succeeds (this route only composes existing, already-typed functions).

- [ ] **Step 3: Manual smoke check (requires a running dev server and a logged-in session cookie)**

Skip automated testing for this thin route (it has no branching logic of its own — every field comes from `getHistoryTotals`, which is already exercised by the History page). Instead, verify manually once local dev server is up: log in via browser, then in the same browser tab visit `http://localhost:3000/api/history-totals` and confirm a `200` JSON response shaped like `{"ok":true,"data":{"dayTotal":...,"weekTotal":...,...}}`.

- [ ] **Step 4: Add the native API client method**

In `apps/native/src/api.ts`, add a new interface right after `StatsOverviewResult` (~line 125):

```ts
export interface HistoryTotalsResult {
  dayTotal: number;
  weekTotal: number;
  weekAverage: number;
  monthTotal: number;
  monthAverage: number;
  target: number | null;
}
```

Then add a new method inside the `api` object, right after the existing `stats(token, days = 30) { ... }` method (~line 749):

```ts
  historyTotals(token: string, date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<HistoryTotalsResult>(`/api/history-totals${query}`, { token });
  },
```

- [ ] **Step 5: Typecheck native**

```
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 6: Commit and push**

```bash
git add apps/web/src/app/api/history-totals/route.ts apps/native/src/api.ts
git commit -m "feat: add /api/history-totals endpoint for native history/progress heroes"
git push
```

- [ ] **Step 7: Deploy the web change to the NAS**

The native app can't reach this endpoint until it's live on production (`nutreluma.com`), since native always talks to the deployed API, never localhost. Deploy now rather than waiting until the end of the plan:

```
SCRATCH="<this session's scratchpad>"
printf '#!/bin/sh\necho '"'"'<NAS password>'"'"'\n' > "$SCRATCH/askpass.sh"; chmod +x "$SCRATCH/askpass.sh"
SSH_ASKPASS="$SCRATCH/askpass.sh" SSH_ASKPASS_REQUIRE=force DISPLAY=:0 \
  ssh -o StrictHostKeyChecking=accept-new TzoyBe@192.168.2.249 \
  "sh /share/CACHEDEV1_DATA/Container/nutreluma/apps/web/deploy.sh" < /dev/null
rm -f "$SCRATCH/askpass.sh"
```
Expected: `BUILD EXIT=0` and both health checks return `{"status":"ok","database":"up"}`. See [[reference-nas-ssh-deploy]] memory for credential handling.

---

### Task 5: Web Progress page

**Files:**
- Create: `apps/web/src/components/progress/progress-universe-model.ts`
- Create: `apps/web/src/components/progress/progress-universe.tsx`
- Modify: `apps/web/src/app/(app)/progress/page.tsx`
- Test: `apps/web/tests/unit/progress-universe-model.test.ts`

**Interfaces:**
- Consumes: CSS classes from Task 1; `getHistoryTotals` (`@/server/services/stats`), `getStatsOverview` (`@/server/services/stats`), `getPersonalCalibration` (`@/server/services/personal-intelligence`) — all already used elsewhere, reused directly (server component, no HTTP round-trip needed on web).
- Produces: `ProgressUniverseInput`, `ProgressUniverseModel`, `buildProgressUniverseModel(input)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/unit/progress-universe-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProgressUniverseModel } from '@/components/progress/progress-universe-model';

describe('buildProgressUniverseModel', () => {
  it('computes a positive delta (above target) and rounds to one decimal', () => {
    expect(
      buildProgressUniverseModel({
        currentWeightKg: 82.34,
        targetWeightKg: 78,
        weekTotalKcal: 13020,
        avg7Kcal: 2103.6,
        calibrationScore: 82,
      }),
    ).toEqual({
      heroDeltaKg: 4.3,
      satellites: [
        { key: 'history', value: 13020, unit: 'kcal', tone: 'cyan', href: '/history' },
        { key: 'stats', value: 2104, unit: 'kcal', tone: 'gold', href: '/stats' },
        { key: 'insights', value: 82, unit: '%', tone: 'violet', href: '/insights' },
      ],
    });
  });

  it('returns a null delta when weight or target data is missing', () => {
    const model = buildProgressUniverseModel({
      currentWeightKg: null,
      targetWeightKg: 78,
      weekTotalKcal: 0,
      avg7Kcal: 0,
      calibrationScore: 0,
    });
    expect(model.heroDeltaKg).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd X:\apps\web && npx vitest run tests/unit/progress-universe-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the model**

Create `apps/web/src/components/progress/progress-universe-model.ts`:

```ts
export interface ProgressUniverseInput {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weekTotalKcal: number;
  avg7Kcal: number;
  calibrationScore: number;
}

export interface ProgressUniverseModel {
  heroDeltaKg: number | null;
  satellites: Array<{
    key: 'history' | 'stats' | 'insights';
    value: number;
    unit: 'kcal' | '%';
    tone: 'cyan' | 'gold' | 'violet';
    href: string;
  }>;
}

export function buildProgressUniverseModel(input: ProgressUniverseInput): ProgressUniverseModel {
  const heroDeltaKg =
    input.currentWeightKg !== null && input.targetWeightKg !== null
      ? Math.round((input.currentWeightKg - input.targetWeightKg) * 10) / 10
      : null;

  return {
    heroDeltaKg,
    satellites: [
      { key: 'history', value: Math.round(input.weekTotalKcal), unit: 'kcal', tone: 'cyan', href: '/history' },
      { key: 'stats', value: Math.round(input.avg7Kcal), unit: 'kcal', tone: 'gold', href: '/stats' },
      { key: 'insights', value: input.calibrationScore, unit: '%', tone: 'violet', href: '/insights' },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/progress-universe-model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the component (satellites are links, unlike the other 3 pages)**

Create `apps/web/src/components/progress/progress-universe.tsx`:

```tsx
import type * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { ProgressUniverseModel } from './progress-universe-model';

export function ProgressUniverse({
  model,
  title,
  labels,
}: {
  model: ProgressUniverseModel;
  title: string;
  labels: Record<'history' | 'stats' | 'insights', string>;
}): React.ReactElement {
  const delta = model.heroDeltaKg;
  const deltaLabel = delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta}`;

  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="progress-universe-title">
        <h2 id="progress-universe-title" className="sr-only">{title}</h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="universe-hero-orbit-center">
          <span>{deltaLabel}</span>
          <span>kg</span>
        </div>
        {model.satellites.map((satellite) => (
          <Link
            key={satellite.key}
            href={satellite.href}
            className="universe-hero-satellite"
            data-tone={satellite.tone}
          >
            <span className="universe-hero-satellite-label">{labels[satellite.key]}</span>
            <span className="universe-hero-satellite-value">
              {satellite.value}
              <span>{satellite.unit}</span>
            </span>
          </Link>
        ))}
      </section>
    </Card>
  );
}
```

- [ ] **Step 6: Wire it into the Progress page**

In `apps/web/src/app/(app)/progress/page.tsx`:
- Add imports:
  ```ts
  import { ProgressUniverse } from '@/components/progress/progress-universe';
  import { buildProgressUniverseModel } from '@/components/progress/progress-universe-model';
  import { getHistoryTotals, getStatsOverview } from '@/server/services/stats';
  import { getPersonalCalibration } from '@/server/services/personal-intelligence';
  import { todayISO } from '@/lib/dates';
  ```
- After `const [profile, weights] = await Promise.all([...]);` add the three teaser fetches (guard on `profile` existing first, matching the existing pattern where `getProfile` result is used unguarded further down — check `profile` for `null` before use, same as the existing code already implicitly assumes a profile exists for `profile?.targetWeightKg`):
  ```ts
  const today = profile ? todayISO(profile.timezone) : null;
  const [historyTotals, statsOverview, calibration] = await Promise.all([
    today ? getHistoryTotals(user.id, today, profile!.timezone, profile!.effectiveDailyCalorieTarget) : null,
    getStatsOverview(user.id, 30),
    getPersonalCalibration(user.id),
  ]);
  const universeModel = buildProgressUniverseModel({
    currentWeightKg: weights[0]?.weightKg ?? null,
    targetWeightKg: profile?.targetWeightKg ?? null,
    weekTotalKcal: historyTotals?.weekTotal ?? 0,
    avg7Kcal: statsOverview.average7,
    calibrationScore: calibration.score,
  });
  ```
- Immediately after the `<div>` header block (title + subtitle) and before the existing `<GoalProgressChart ... />`, insert:
  ```tsx
  <ProgressUniverse
    model={universeModel}
    title={t('progress.title')}
    labels={{
      history: t('progress.history'),
      stats: t('progress.stats'),
      insights: t('progress.insights'),
    }}
  />
  ```

- [ ] **Step 7: Typecheck and build**

```
cd X:\apps\web
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed.

- [ ] **Step 8: Visual check**

Open `/progress`, confirm the hero (weight delta + 3 tappable satellites) renders above the existing weight chart and nav cards; click each satellite and confirm it navigates to `/history`, `/stats`, `/insights` respectively.

- [ ] **Step 9: Commit, push, and redeploy**

```bash
git add apps/web/src/components/progress/progress-universe-model.ts apps/web/src/components/progress/progress-universe.tsx "apps/web/src/app/(app)/progress/page.tsx" apps/web/tests/unit/progress-universe-model.test.ts
git commit -m "feat(web): add universe hero to Progress page"
git push
```
Redeploy to the NAS (same command as Task 4 Step 7) so the live site reflects all 4 web pages before starting native work.

---

### Task 6: Native model builders (all 4 pages, one file)

**Files:**
- Modify: `apps/native/src/personal-universe-model.ts`
- Test: `apps/native/src/personal-universe-model.test.ts`

**Interfaces:**
- Produces: `buildNativeStatsUniverse`, `buildNativeHistoryUniverse`, `buildNativeInsightsUniverse`, `buildNativeProgressUniverse` (+ their `Native*UniverseInput`/`Native*UniverseModel` types), consumed by Tasks 7–10.
- Consumes: existing `NativeUniverseTone` type (already exported at the top of this file).

- [ ] **Step 1: Write the failing tests**

Append to `apps/native/src/personal-universe-model.test.ts` (add these `import`s to the existing `import { ... } from './personal-universe-model';` line, and these new `describe` blocks at the end of the file):

```ts
import {
  buildNativeGoalUniverse,
  buildNativeProfileUniverse,
  buildNativeStatsUniverse,
  buildNativeHistoryUniverse,
  buildNativeInsightsUniverse,
  buildNativeProgressUniverse,
} from './personal-universe-model';
```

```ts
describe('buildNativeStatsUniverse', () => {
  it('rounds averages and labels the within-target percent', () => {
    expect(
      buildNativeStatsUniverse({
        average7: 2103.6,
        average30: 1987.2,
        weekTotal: 14725,
        daysWithinTargetPercent: 71,
      }),
    ).toEqual({
      hero: 2104,
      satellites: [
        { key: 'average30', label: 'Avg 30', value: '1987', unit: 'kcal', tone: 'cyan' },
        { key: 'weekTotal', label: 'Week total', value: '14725', unit: 'kcal', tone: 'gold' },
        { key: 'daysWithinTarget', label: 'Within target', value: '71', unit: '%', tone: 'violet' },
      ],
    });
  });

  it('shows "--" with no unit when the within-target percent is null', () => {
    const model = buildNativeStatsUniverse({
      average7: 0,
      average30: 0,
      weekTotal: 0,
      daysWithinTargetPercent: null,
    });
    expect(model.satellites[2]).toEqual({
      key: 'daysWithinTarget',
      label: 'Within target',
      value: '--',
      unit: undefined,
      tone: 'violet',
    });
  });
});

describe('buildNativeHistoryUniverse', () => {
  it('rounds each kcal total', () => {
    expect(
      buildNativeHistoryUniverse({
        dayTotal: 1842.4,
        weekTotal: 12903.9,
        weekAverage: 1843.4,
        monthAverage: 1901.1,
      }),
    ).toEqual({
      hero: 1842,
      satellites: [
        { key: 'weekTotal', label: 'Week total', value: '12904', unit: 'kcal', tone: 'cyan' },
        { key: 'weekAverage', label: 'Week avg', value: '1843', unit: 'kcal', tone: 'gold' },
        { key: 'monthAverage', label: 'Month avg', value: '1901', unit: 'kcal', tone: 'violet' },
      ],
    });
  });
});

describe('buildNativeInsightsUniverse', () => {
  it('builds the hero and all three satellites when energy data exists', () => {
    expect(
      buildNativeInsightsUniverse({
        calibrationScore: 82,
        qualityScore: 64,
        correctionRate30d: 12,
        energyConfidencePercent: 71,
      }),
    ).toEqual({
      hero: 82,
      satellites: [
        { key: 'dataConfidence', label: 'Data confidence', value: '64', unit: '%', tone: 'cyan' },
        { key: 'correctionRate', label: '30d corrections', value: '12', unit: '%', tone: 'gold' },
        { key: 'energyConfidence', label: 'Energy confidence', value: '71', unit: '%', tone: 'violet' },
      ],
    });
  });

  it('shows "--" with no unit when quality or energy data is missing', () => {
    const model = buildNativeInsightsUniverse({
      calibrationScore: 0,
      qualityScore: null,
      correctionRate30d: 0,
      energyConfidencePercent: null,
    });
    expect(model.satellites[0]).toEqual({
      key: 'dataConfidence',
      label: 'Data confidence',
      value: '--',
      unit: undefined,
      tone: 'cyan',
    });
    expect(model.satellites[2]).toEqual({
      key: 'energyConfidence',
      label: 'Energy confidence',
      value: '--',
      unit: undefined,
      tone: 'violet',
    });
  });
});

describe('buildNativeProgressUniverse', () => {
  it('computes a positive delta (above target) and rounds to one decimal', () => {
    expect(
      buildNativeProgressUniverse({
        currentWeightKg: 82.34,
        targetWeightKg: 78,
        weekTotalKcal: 13020,
        avg7Kcal: 2103.6,
        calibrationScore: 82,
      }),
    ).toEqual({
      heroDeltaKg: 4.3,
      satellites: [
        { key: 'history', label: 'This week', value: '13020', unit: 'kcal', tone: 'cyan' },
        { key: 'stats', label: '7-day avg', value: '2104', unit: 'kcal', tone: 'gold' },
        { key: 'insights', label: 'Calibration', value: '82', unit: '%', tone: 'violet' },
      ],
    });
  });

  it('returns a null delta when weight or target data is missing', () => {
    const model = buildNativeProgressUniverse({
      currentWeightKg: null,
      targetWeightKg: 78,
      weekTotalKcal: 0,
      avg7Kcal: 0,
      calibrationScore: 0,
    });
    expect(model.heroDeltaKg).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
net use X: \\tzoybe-nas\Container\nutreluma
cd X:\apps\native
npx vitest run src/personal-universe-model.test.ts
```
Expected: FAIL — the 4 new functions don't exist yet.

- [ ] **Step 3: Add the 4 model builders**

Append to the end of `apps/native/src/personal-universe-model.ts`:

```ts
export interface NativeStatsUniverseInput {
  average7: number;
  average30: number;
  weekTotal: number;
  daysWithinTargetPercent: number | null;
}

export interface NativeStatsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'average30' | 'weekTotal' | 'daysWithinTarget';
    label: string;
    value: string;
    unit?: string;
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeStatsUniverse(input: NativeStatsUniverseInput): NativeStatsUniverseModel {
  return {
    hero: Math.round(input.average7),
    satellites: [
      { key: 'average30', label: 'Avg 30', value: `${Math.round(input.average30)}`, unit: 'kcal', tone: 'cyan' },
      { key: 'weekTotal', label: 'Week total', value: `${Math.round(input.weekTotal)}`, unit: 'kcal', tone: 'gold' },
      {
        key: 'daysWithinTarget',
        label: 'Within target',
        value: input.daysWithinTargetPercent === null ? '--' : `${input.daysWithinTargetPercent}`,
        unit: input.daysWithinTargetPercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}

export interface NativeHistoryUniverseInput {
  dayTotal: number;
  weekTotal: number;
  weekAverage: number;
  monthAverage: number;
}

export interface NativeHistoryUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'weekTotal' | 'weekAverage' | 'monthAverage';
    label: string;
    value: string;
    unit: 'kcal';
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeHistoryUniverse(input: NativeHistoryUniverseInput): NativeHistoryUniverseModel {
  return {
    hero: Math.round(input.dayTotal),
    satellites: [
      { key: 'weekTotal', label: 'Week total', value: `${Math.round(input.weekTotal)}`, unit: 'kcal', tone: 'cyan' },
      { key: 'weekAverage', label: 'Week avg', value: `${Math.round(input.weekAverage)}`, unit: 'kcal', tone: 'gold' },
      { key: 'monthAverage', label: 'Month avg', value: `${Math.round(input.monthAverage)}`, unit: 'kcal', tone: 'violet' },
    ],
  };
}

export interface NativeInsightsUniverseInput {
  calibrationScore: number;
  qualityScore: number | null;
  correctionRate30d: number;
  energyConfidencePercent: number | null;
}

export interface NativeInsightsUniverseModel {
  hero: number;
  satellites: Array<{
    key: 'dataConfidence' | 'correctionRate' | 'energyConfidence';
    label: string;
    value: string;
    unit?: string;
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeInsightsUniverse(input: NativeInsightsUniverseInput): NativeInsightsUniverseModel {
  return {
    hero: input.calibrationScore,
    satellites: [
      {
        key: 'dataConfidence',
        label: 'Data confidence',
        value: input.qualityScore === null ? '--' : `${input.qualityScore}`,
        unit: input.qualityScore === null ? undefined : '%',
        tone: 'cyan',
      },
      { key: 'correctionRate', label: '30d corrections', value: `${input.correctionRate30d}`, unit: '%', tone: 'gold' },
      {
        key: 'energyConfidence',
        label: 'Energy confidence',
        value: input.energyConfidencePercent === null ? '--' : `${input.energyConfidencePercent}`,
        unit: input.energyConfidencePercent === null ? undefined : '%',
        tone: 'violet',
      },
    ],
  };
}

export interface NativeProgressUniverseInput {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weekTotalKcal: number;
  avg7Kcal: number;
  calibrationScore: number;
}

export interface NativeProgressUniverseModel {
  heroDeltaKg: number | null;
  satellites: Array<{
    key: 'history' | 'stats' | 'insights';
    label: string;
    value: string;
    unit?: string;
    tone: NativeUniverseTone;
  }>;
}

export function buildNativeProgressUniverse(input: NativeProgressUniverseInput): NativeProgressUniverseModel {
  const heroDeltaKg =
    input.currentWeightKg !== null && input.targetWeightKg !== null
      ? Math.round((input.currentWeightKg - input.targetWeightKg) * 10) / 10
      : null;

  return {
    heroDeltaKg,
    satellites: [
      { key: 'history', label: 'This week', value: `${Math.round(input.weekTotalKcal)}`, unit: 'kcal', tone: 'cyan' },
      { key: 'stats', label: '7-day avg', value: `${Math.round(input.avg7Kcal)}`, unit: 'kcal', tone: 'gold' },
      { key: 'insights', label: 'Calibration', value: `${input.calibrationScore}`, unit: '%', tone: 'violet' },
    ],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd X:\apps\native
npx vitest run src/personal-universe-model.test.ts
```
Expected: PASS (all tests, old + new).

- [ ] **Step 5: Typecheck**

```
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 6: Commit and push**

```bash
git add apps/native/src/personal-universe-model.ts apps/native/src/personal-universe-model.test.ts
git commit -m "feat(native): add universe model builders for stats/history/insights/progress"
git push
```

---

### Task 7: Native Stats screen

**Files:**
- Modify: `apps/native/App.tsx` (`StatsScreen`, ~line 2495)

**Interfaces:**
- Consumes: `buildNativeStatsUniverse` (Task 6), `UniverseHero`/`UniverseMetric` (existing, already imported in `App.tsx`).

- [ ] **Step 1: Wire the hero into `StatsScreen`**

In `App.tsx`, inside `StatsScreen`, right after the existing `const timeRows = ...` block (~line 2552) and before the `return (`, add:

```ts
  const universeModel = stats
    ? buildNativeStatsUniverse({
        average7: stats.average7,
        average30: stats.average30,
        weekTotal: stats.weekTotal,
        daysWithinTargetPercent: stats.daysWithinTargetPercent,
      })
    : null;
```

Then, inside the existing `{loading ? (...) : (` populated branch, immediately before the current `<View style={styles.macroGrid}>` (the 4 `MetricCard`s), insert:

```tsx
{universeModel ? (
  <UniverseReveal index={0}>
    <UniverseHero
      eyebrow={`${days}-day overview`}
      title="Your stats universe"
      subtitle="A snapshot of your recent calorie consistency."
      accessibilityLabel={`Average 7-day calories: ${universeModel.hero}`}
      center={(
        <View style={styles.goalHeroCenterCopy}>
          <Text selectable style={styles.goalHeroCalories}>{universeModel.hero}</Text>
          <Text style={styles.goalHeroUnit}>kcal · 7-day avg</Text>
        </View>
      )}
      satellites={universeModel.satellites.map((satellite) => (
        <UniverseMetric
          key={satellite.key}
          label={satellite.label}
          value={satellite.value}
          unit={satellite.unit}
          tone={satellite.tone}
        />
      ))}
    />
  </UniverseReveal>
) : null}
```

Add `buildNativeStatsUniverse` to the existing `import { ... } from './src/personal-universe-model';` line near the top of `App.tsx` (alongside `buildNativeRecipeUniverse`, etc.).

- [ ] **Step 2: Typecheck**

```
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 3: Manual verification**

Run the app (`npm run android` or `npm run ios`), navigate to Stats, confirm the hero renders above the existing 4-tile row and the range toggle / charts still work.

- [ ] **Step 4: Commit and push**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): add universe hero to Stats screen"
git push
```

---

### Task 8: Native History screen

**Files:**
- Modify: `apps/native/App.tsx` (`HistoryScreen`, ~line 2230)

**Interfaces:**
- Consumes: `buildNativeHistoryUniverse` (Task 6), `api.historyTotals` (Task 4).

- [ ] **Step 1: Fetch totals and wire the hero into `HistoryScreen`**

In `App.tsx`, inside `HistoryScreen`, add a new state variable alongside the existing ones:

```ts
  const [totals, setTotals] = useState<HistoryTotalsResult | null>(null);
```

In the existing `async function load(nextPage = page, isRefresh = false) { ... }`, add a parallel fetch (inside the `try` block, alongside the existing `api.meals(...)` call):

```ts
      const [result, totalsResult] = await Promise.all([
        api.meals(session.token, {
          page: nextPage,
          pageSize,
          from,
          to,
          mealType,
          search,
          minCalories,
          maxCalories,
        }),
        api.historyTotals(session.token),
      ]);
      setMeals(Array.isArray(result.meals) ? result.meals : []);
      setTotal(result.total ?? 0);
      setPage(result.page ?? nextPage);
      setTotals(totalsResult);
```
(Remove the old single-call `const result = await api.meals(...)` — replace it with the `Promise.all` above.)

Then, right before the existing `return (`, add:

```ts
  const universeModel = totals ? buildNativeHistoryUniverse(totals) : null;
```

Inside the JSX, right after the existing `<View style={styles.dashboardHeader}>...</View>` block and before the `<GlassCard style={styles.authPanel}>` (the "Find a meal" filter panel), insert:

```tsx
{universeModel ? (
  <UniverseReveal index={0}>
    <UniverseHero
      eyebrow="Today"
      title="Your history universe"
      subtitle="How today compares to your recent averages."
      accessibilityLabel={`Today's total: ${universeModel.hero} kcal`}
      center={(
        <View style={styles.goalHeroCenterCopy}>
          <Text selectable style={styles.goalHeroCalories}>{universeModel.hero}</Text>
          <Text style={styles.goalHeroUnit}>kcal today</Text>
        </View>
      )}
      satellites={universeModel.satellites.map((satellite) => (
        <UniverseMetric
          key={satellite.key}
          label={satellite.label}
          value={satellite.value}
          unit={satellite.unit}
          tone={satellite.tone}
        />
      ))}
    />
  </UniverseReveal>
) : null}
```

Add `buildNativeHistoryUniverse` and `HistoryTotalsResult` to the existing top-of-file imports (`./src/personal-universe-model` and `./src/api` respectively).

- [ ] **Step 2: Typecheck**

```
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 3: Manual verification**

Run the app, navigate to History, confirm the hero renders above the filter panel, filtering/pagination/delete still work.

- [ ] **Step 4: Commit and push**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): add universe hero to History screen"
git push
```

---

### Task 9: Native Insights screen

**Files:**
- Modify: `apps/native/App.tsx` (`InsightsScreen`, ~line 2664)

**Interfaces:**
- Consumes: `buildNativeInsightsUniverse` (Task 6).

- [ ] **Step 1: Wire the hero into `InsightsScreen`**

In `App.tsx`, inside `InsightsScreen`, right after the existing `const quality = insights?.quality;` line, add:

```ts
  const universeModel =
    calibration && quality
      ? buildNativeInsightsUniverse({
          calibrationScore: calibration.score,
          qualityScore: quality.score,
          correctionRate30d: intelligence?.correctionRates?.['30d'] ?? 0,
          energyConfidencePercent: insights?.energy ? Math.round(insights.energy.confidence * 100) : null,
        })
      : null;
```

Inside the existing `{loading ? (...) : (<>` populated branch, replace the current `<View style={styles.macroGrid}>...</View>` block (the 3 `MetricCard`s) with:

```tsx
{universeModel ? (
  <UniverseReveal index={0}>
    <UniverseHero
      eyebrow="Personal signals"
      title="Your insights universe"
      subtitle="How well the app understands your logging habits."
      accessibilityLabel={`Calibration score: ${universeModel.hero}%`}
      center={(
        <View style={styles.goalHeroCenterCopy}>
          <Text selectable style={styles.goalHeroCalories}>{universeModel.hero}%</Text>
          <Text style={styles.goalHeroUnit}>calibration</Text>
        </View>
      )}
      satellites={universeModel.satellites.map((satellite) => (
        <UniverseMetric
          key={satellite.key}
          label={satellite.label}
          value={satellite.value}
          unit={satellite.unit}
          tone={satellite.tone}
        />
      ))}
    />
  </UniverseReveal>
) : (
  <View style={styles.macroGrid}>
    <MetricCard value={calibration ? `${calibration.score}%` : '--'} label="calibration" />
    <MetricCard value={quality ? `${quality.score}%` : '--'} label={`quality ${quality?.level ?? ''}`} />
    <MetricCard value={`${intelligence?.correctionRates?.['30d'] ?? 0}%`} label="30d corrections" />
  </View>
)}
```

(The `MetricCard` fallback keeps the screen working identically to today when calibration/quality data isn't loaded yet.)

Add `buildNativeInsightsUniverse` to the existing `./src/personal-universe-model` import line.

- [ ] **Step 2: Typecheck**

```
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 3: Manual verification**

Run the app, navigate to Insights, confirm the hero renders in place of the old 3-tile grid, energy card and patterns list unchanged.

- [ ] **Step 4: Commit and push**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): add universe hero to Insights screen"
git push
```

---

### Task 10: Native Progress screen

**Files:**
- Modify: `apps/native/App.tsx` (`ProgressScreen`, ~line 4330)

**Interfaces:**
- Consumes: `buildNativeProgressUniverse` (Task 6), `api.historyTotals` (Task 4), `api.stats`, `api.intelligence` (existing).

- [ ] **Step 1: Fetch the three teasers and wire the hero into `ProgressScreen`**

In `App.tsx`, inside `ProgressScreen`, add new state:

```ts
  const [universeModel, setUniverseModel] = useState<NativeProgressUniverseModel | null>(null);
```

In the existing `async function load(isRefresh = false) { ... }`, extend the `Promise.all` to include the 3 teaser fetches and build the model:

```ts
    try {
      const [weightRes, profileRes, historyTotals, stats, intelligence] = await Promise.all([
        api.weights(session.token),
        api.profile(session.token),
        api.historyTotals(session.token),
        api.stats(session.token, 30),
        api.intelligence(session.token),
      ]);
      setWeights(weightRes.entries ?? []);
      setTargetWeightKg(profileRes.profile?.targetWeightKg ?? null);
      setUniverseModel(
        buildNativeProgressUniverse({
          currentWeightKg: weightRes.entries?.[0]?.weightKg ?? null,
          targetWeightKg: profileRes.profile?.targetWeightKg ?? null,
          weekTotalKcal: historyTotals.weekTotal,
          avg7Kcal: stats.average7,
          calibrationScore: intelligence.calibration?.score ?? 0,
        }),
      );
    } catch {
      // Κρατάμε ό,τι έχουμε ήδη· το γράφημα δείχνει κενή κατάσταση αν χρειαστεί.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
```

Inside the JSX, right after the existing `<View style={styles.dashboardHeader}>...</View>` and before the `{loading ? (...) : (<GoalProgressChart .../>)}` block, insert:

```tsx
{universeModel ? (
  <UniverseReveal index={0}>
    <UniverseHero
      eyebrow="Your progress"
      title="Your progress universe"
      subtitle="Weight vs. target, with quick jumps into history, stats, and insights."
      accessibilityLabel={
        universeModel.heroDeltaKg === null
          ? 'Weight delta unavailable'
          : `${universeModel.heroDeltaKg > 0 ? 'Above' : 'At or below'} target by ${Math.abs(universeModel.heroDeltaKg)} kilograms`
      }
      center={(
        <View style={styles.goalHeroCenterCopy}>
          <Text selectable style={styles.goalHeroCalories}>
            {universeModel.heroDeltaKg === null
              ? '--'
              : `${universeModel.heroDeltaKg > 0 ? '+' : ''}${universeModel.heroDeltaKg}`}
          </Text>
          <Text style={styles.goalHeroUnit}>kg vs. target</Text>
        </View>
      )}
      satellites={universeModel.satellites.map((satellite) => (
        <Pressable
          key={satellite.key}
          onPress={
            satellite.key === 'history' ? onOpenHistory : satellite.key === 'stats' ? onOpenStats : onOpenInsights
          }
        >
          <UniverseMetric
            label={satellite.label}
            value={satellite.value}
            unit={satellite.unit}
            tone={satellite.tone}
          />
        </Pressable>
      ))}
    />
  </UniverseReveal>
) : null}
```

Add `buildNativeProgressUniverse` and its `NativeProgressUniverseModel` type to the existing `./src/personal-universe-model` import line.

- [ ] **Step 2: Typecheck**

```
cd X:\apps\native
npm run typecheck
```
Expected: succeeds.

- [ ] **Step 3: Manual verification**

Run the app, navigate to Progress, confirm the hero renders above the weight chart, tapping each satellite navigates to History/Stats/Insights respectively (same as the existing nav cards below), and the existing nav cards still work too.

- [ ] **Step 4: Commit and push**

```bash
git add apps/native/App.tsx
git commit -m "feat(native): add universe hero to Progress screen"
git push
```

---

### Task 11: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full web test suite**

```
cd X:\apps\web
npx vitest run
```
Expected: all tests pass, including the 4 new `*-universe-model.test.ts` files.

- [ ] **Step 2: Full web build**

```
npx tsc --noEmit
npm run build -- --webpack
```
Expected: both succeed with no errors or warnings about the new files.

- [ ] **Step 3: Full native test + typecheck**

```
cd X:\apps\native
npx vitest run
npm run typecheck
```
Expected: all tests pass (including the 8 new tests from Task 6), typecheck clean.

- [ ] **Step 4: Confirm the web deploy is current**

Since Task 4 and Task 5 already redeployed, only redeploy again if Tasks 6–10 (native-only) didn't touch any web file — in that case no further web deploy is needed. If anything web-side changed after Task 5, redeploy using the same command as Task 4 Step 7.

- [ ] **Step 5: Note the native rollout**

Native changes ship on the next `npm run build:android:production` / iOS build — no immediate action required beyond what's already documented in this project's existing release process. Let the user know a new build is needed to see the native changes on a device.
