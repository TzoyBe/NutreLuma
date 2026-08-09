# Meal History & Quick-Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add meal-history browsing plus one-tap re-entry of a user's favorite / frequent / recent meals — with backend-authoritative fingerprinting, ranking and portion scaling, and never a new AI request.

**Architecture:** Frequent/recent are computed on read by grouping the user's CONFIRMED meals on a new indexed `Meal.mealFingerprint` column. Favorites are per-fingerprint template rows (`FavoriteMeal`) with a self-contained snapshot. Quick-pick reuses the existing `createManualMeal` (CONFIRMED, no AI, idempotent) to write an independent copy. A new `/meals/add` hub surfaces Favorites → Frequent → Recent → Photo/Manual.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript, Prisma/PostgreSQL 16, Zod, Vitest, Tailwind. Macros are `Prisma.Decimal` (decimal-safe); calories/sodium are `Int`.

## Global Constraints

- **Not a git repo** (`\\tzoybe-nas\Container\nutreluma`). Replace every "Commit" step with a **Checkpoint**: re-run the task's tests and confirm green. Do NOT run `git`.
- **UNC/npm constraint:** `npm` does not run over the UNC path. Run all verification (`tsc`, `vitest`, `next build`) from a **local copy** of the project (`robocopy`/`cp` to a local folder, `npm ci`, run there), or inside the NAS container. Never `npm install` directly on `\\tzoybe-nas\...`.
- **User isolation is mandatory:** every query filters by `userId` taken from the session (`requireApiUser()`), never from client input. Every ownership check is `where: { id, userId }` → `NOT_FOUND` on miss (anti-IDOR).
- **No AI on quick-pick:** the quick-pick create/preview paths must never call `analyzeMealImage`/`refineMealAnalysis`.
- **Macros are `null` = unknown, never 0.** Preserve this everywhere.
- **i18n:** every user-facing string added to both `src/i18n/el.ts` and `src/i18n/en.ts`. Greek is the source dictionary.
- **Excluded meal statuses** for history/quick-pick surfaces: `PENDING`, `ANALYZING`, `REVIEW_REQUIRED`, `FAILED`, `CANCELLED`. Only `CONFIRMED` counts.
- **Ranking is backend-only.** The frontend renders the already-ordered list.
- Reuse, don't rewrite: `createManualMeal`, `listMealHistory`, `toMealView`/`MEAL_SELECT`, `getUserTimezone`, http helpers (`withErrorHandling`, `assertSameOrigin`, `jsonOk`, `ApiError`), guards (`requireApiUser`, `requireWriteAccess`), `hitLimit`, `localDateTimeToUtc`, `normalizeCalories`, `isAboveSoftLimit`.

**Spec:** `docs/superpowers/specs/2026-08-06-meal-history-quick-pick-design.md`

---

## Phase 1 — Data model & migration

### Task 1: Prisma schema — `mealFingerprint` + `FavoriteMeal` + backfill

**Files:**
- Modify: `prisma/schema.prisma` (Meal model, User model; add FavoriteMeal)
- Create: `prisma/migrations/2026080700000_meal_history/migration.sql`
- Create: `prisma/backfill-fingerprints.ts`

**Interfaces:**
- Produces: `Meal.mealFingerprint: string | null`; model `FavoriteMeal`; relation `User.favoriteMeals`.

- [ ] **Step 1: Add the fingerprint column to `Meal`**

In `prisma/schema.prisma`, inside `model Meal`, after `requestKey` add:
```prisma
  mealFingerprint     String?
```
And add to the Meal indexes block:
```prisma
  @@index([userId, mealFingerprint])
```

- [ ] **Step 2: Add the `FavoriteMeal` model**

Append to `prisma/schema.prisma`:
```prisma
model FavoriteMeal {
  id          String   @id @default(cuid())
  userId      String
  fingerprint String
  title       String?
  mealType    MealType
  calories    Int?
  proteinGrams      Decimal? @db.Decimal(7, 2)
  carbohydrateGrams Decimal? @db.Decimal(7, 2)
  fatGrams          Decimal? @db.Decimal(7, 2)
  fiberGrams        Decimal? @db.Decimal(7, 2)
  sugarGrams        Decimal? @db.Decimal(7, 2)
  saturatedFatGrams Decimal? @db.Decimal(7, 2)
  sodiumMg          Int?
  items       Json
  thumbKey    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, fingerprint])
  @@index([userId])
  @@map("favorite_meals")
}
```
Add `favoriteMeals FavoriteMeal[]` to the `User` model relations block.

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/2026080700000_meal_history/migration.sql`:
```sql
ALTER TABLE "meals" ADD COLUMN "mealFingerprint" TEXT;
CREATE INDEX "meals_userId_mealFingerprint_idx" ON "meals"("userId", "mealFingerprint");

CREATE TABLE "favorite_meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT,
    "mealType" "MealType" NOT NULL,
    "calories" INTEGER,
    "proteinGrams" DECIMAL(7,2),
    "carbohydrateGrams" DECIMAL(7,2),
    "fatGrams" DECIMAL(7,2),
    "fiberGrams" DECIMAL(7,2),
    "sugarGrams" DECIMAL(7,2),
    "saturatedFatGrams" DECIMAL(7,2),
    "sodiumMg" INTEGER,
    "items" JSONB NOT NULL,
    "thumbKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "favorite_meals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "favorite_meals_userId_fingerprint_key" ON "favorite_meals"("userId", "fingerprint");
CREATE INDEX "favorite_meals_userId_idx" ON "favorite_meals"("userId");
ALTER TABLE "favorite_meals" ADD CONSTRAINT "favorite_meals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate the Prisma client**

Run (from local copy): `npx prisma generate`
Expected: client types include `mealFingerprint` and `prisma.favoriteMeal`.

- [ ] **Step 5: Write the backfill script** (depends on Task 2's `computeMealFingerprint`, implemented next — leave the import; the script is run after Task 2)

Create `prisma/backfill-fingerprints.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { computeMealFingerprint } from '../src/lib/meal-fingerprint';

const prisma = new PrismaClient();

async function main() {
  const BATCH = 200;
  let cursor: string | undefined;
  let updated = 0;
  for (;;) {
    const meals = await prisma.meal.findMany({
      where: { status: 'CONFIRMED', mealFingerprint: null },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, title: true, mealType: true, finalCalories: true,
        items: { select: { name: true, finalCalories: true } },
      },
    });
    if (meals.length === 0) break;
    for (const m of meals) {
      const fingerprint = computeMealFingerprint({
        title: m.title,
        mealType: m.mealType,
        totalCalories: m.finalCalories,
        items: m.items.map((i) => ({ name: i.name, calories: i.finalCalories })),
      });
      await prisma.meal.update({ where: { id: m.id }, data: { mealFingerprint: fingerprint } });
      updated++;
    }
    cursor = meals[meals.length - 1].id;
  }
  console.log(`Backfilled ${updated} meals.`);
}

main().finally(() => prisma.$disconnect());
```
Add to `package.json` scripts: `"backfill:fingerprints": "tsx prisma/backfill-fingerprints.ts"`.

- [ ] **Step 6: Checkpoint** — `npx prisma validate` passes; `npx prisma generate` succeeds. (Run migration + backfill after Task 2 lands.)

---

## Phase 2 — Pure libs (TDD)

### Task 2: `computeMealFingerprint`

**Files:**
- Create: `src/lib/meal-fingerprint.ts`
- Test: `tests/unit/meal-fingerprint.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface FingerprintInput {
    title: string | null;
    mealType: string;
    totalCalories: number | null;
    items: Array<{ name: string; calories: number | null }>;
  }
  function computeMealFingerprint(input: FingerprintInput): string; // sha256 hex
  function normalizeText(value: string): string;
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/meal-fingerprint.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeMealFingerprint, normalizeText } from '@/lib/meal-fingerprint';

const base = {
  title: 'Κοτόπουλο με ρύζι',
  mealType: 'LUNCH',
  totalCalories: 600,
  items: [
    { name: 'Κοτόπουλο', calories: 350 },
    { name: 'Ρύζι', calories: 250 },
  ],
};

describe('normalizeText', () => {
  it('lowercases, trims, collapses spaces, strips diacritics and punctuation', () => {
    expect(normalizeText('  Κοτόπουλο,   ΨΗΤΟ! ')).toBe('κοτοπουλο ψητο');
    expect(normalizeText('Crème Brûlée')).toBe('creme brulee');
  });
});

describe('computeMealFingerprint', () => {
  it('is deterministic', () => {
    expect(computeMealFingerprint(base)).toBe(computeMealFingerprint(base));
  });

  it('ignores item order', () => {
    const reordered = { ...base, items: [...base.items].reverse() };
    expect(computeMealFingerprint(reordered)).toBe(computeMealFingerprint(base));
  });

  it('ignores accents/case/whitespace in titles and item names', () => {
    const variant = {
      ...base,
      title: 'κοτοπουλο  με  ρυζι',
      items: [{ name: 'κοτοπουλο', calories: 350 }, { name: 'ρυζι', calories: 250 }],
    };
    expect(computeMealFingerprint(variant)).toBe(computeMealFingerprint(base));
  });

  it('groups near-equal item calories (within 25 kcal bucket)', () => {
    const close = {
      ...base,
      items: [{ name: 'Κοτόπουλο', calories: 360 }, { name: 'Ρύζι', calories: 240 }],
    };
    expect(computeMealFingerprint(close)).toBe(computeMealFingerprint(base));
  });

  it('does NOT group different compositions with the same total calories', () => {
    const different = {
      ...base,
      title: 'Σαλάτα',
      items: [{ name: 'Μαρούλι', calories: 100 }, { name: 'Τόνος', calories: 500 }],
    };
    expect(computeMealFingerprint(different)).not.toBe(computeMealFingerprint(base));
  });

  it('does NOT group different item calories beyond the bucket', () => {
    const heavier = {
      ...base,
      items: [{ name: 'Κοτόπουλο', calories: 500 }, { name: 'Ρύζι', calories: 250 }],
    };
    expect(computeMealFingerprint(heavier)).not.toBe(computeMealFingerprint(base));
  });

  it('falls back to item names when title is empty', () => {
    const noTitle = { ...base, title: null };
    expect(computeMealFingerprint(noTitle)).toHaveLength(64);
  });

  it('handles itemless meals via title + total calorie bucket', () => {
    const fp = computeMealFingerprint({ title: 'Πρωτεΐνη', mealType: 'OTHER', totalCalories: 120, items: [] });
    expect(fp).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- meal-fingerprint`
Expected: FAIL ("Cannot find module '@/lib/meal-fingerprint'").

- [ ] **Step 3: Implement**

Create `src/lib/meal-fingerprint.ts`:
```ts
import { createHash } from 'node:crypto';

const CALORIE_BUCKET = 25;

/** lowercase, trim, collapse whitespace, strip diacritics (Greek+Latin) & punctuation. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics (accents, tonos, dialytika)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

function bucket(calories: number | null): number {
  if (calories === null || !Number.isFinite(calories)) return 0;
  return Math.round(calories / CALORIE_BUCKET) * CALORIE_BUCKET;
}

export interface FingerprintInput {
  title: string | null;
  mealType: string;
  totalCalories: number | null;
  items: Array<{ name: string; calories: number | null }>;
}

/**
 * Ντετερμινιστικό fingerprint σύνθεσης γεύματος. Ομαδοποιεί «αρκετά κοντινά»
 * γεύματα (bucket 25 kcal ανά τρόφιμο) χωρίς να ενώνει διαφορετικά γεύματα
 * μόνο επειδή έχουν ίδιες συνολικές θερμίδες. Το `source` ΔΕΝ συμμετέχει.
 */
export function computeMealFingerprint(input: FingerprintInput): string {
  const itemSigs = input.items
    .map((i) => `${normalizeText(i.name)}:${bucket(i.calories)}`)
    .sort();

  const titlePart =
    normalizeText(input.title ?? '') ||
    (itemSigs.length > 0
      ? itemSigs.map((s) => s.split(':')[0]).join(' ')
      : String(bucket(input.totalCalories)));

  const canonical = [
    titlePart,
    input.mealType,
    itemSigs.length > 0 ? itemSigs.join(',') : `total:${bucket(input.totalCalories)}`,
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- meal-fingerprint`
Expected: PASS (all 9).

- [ ] **Step 5: Run migration + backfill** (now that the fingerprint fn exists)

Run (from local copy / NAS container against the db): `npx prisma migrate deploy` then `npm run backfill:fingerprints`
Expected: migration applied; "Backfilled N meals."

- [ ] **Step 6: Checkpoint** — fingerprint tests green.

---

### Task 3: `scaleComposition` (decimal-safe portion scaling)

**Files:**
- Create: `src/lib/meal-scaling.ts`
- Test: `tests/unit/meal-scaling.test.ts`

**Interfaces:**
- Consumes: `MacroView` shape (protein/carb/fat/fiber/sugar/saturatedFat grams + sodiumMg), calories.
- Produces:
  ```ts
  interface ScalableItem { name: string; estimatedQuantity: string | null; finalCalories: number | null; macros: MacroFields; }
  interface ScalableComposition { finalCalories: number | null; macros: MacroFields; items: ScalableItem[]; }
  interface MacroFields { proteinGrams: number | null; carbohydrateGrams: number | null; fatGrams: number | null; fiberGrams: number | null; sugarGrams: number | null; saturatedFatGrams: number | null; sodiumMg: number | null; }
  const SERVING_PRESETS = [0.5, 1, 1.5, 2] as const;
  function scaleComposition(base: ScalableComposition, multiplier: number): ScalableComposition;
  ```

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/meal-scaling.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { scaleComposition } from '@/lib/meal-scaling';

const macros = {
  proteinGrams: 30, carbohydrateGrams: 45.5, fatGrams: 10, fiberGrams: 3,
  sugarGrams: 5, saturatedFatGrams: 2.25, sodiumMg: 400,
};
const base = { finalCalories: 600, macros, items: [
  { name: 'Κοτόπουλο', estimatedQuantity: '150 g', finalCalories: 350, macros },
] };

describe('scaleComposition', () => {
  it('scales calories and all macros proportionally at 0.5', () => {
    const r = scaleComposition(base, 0.5);
    expect(r.finalCalories).toBe(300);
    expect(r.macros.proteinGrams).toBe(15);
    expect(r.macros.carbohydrateGrams).toBe(22.75);
    expect(r.macros.saturatedFatGrams).toBe(1.13); // 2.25*0.5=1.125 -> 1.13 (2dp)
    expect(r.macros.sodiumMg).toBe(200);
  });

  it('is identity at multiplier 1', () => {
    const r = scaleComposition(base, 1);
    expect(r.finalCalories).toBe(600);
    expect(r.macros.carbohydrateGrams).toBe(45.5);
  });

  it('scales items too', () => {
    const r = scaleComposition(base, 2);
    expect(r.items[0].finalCalories).toBe(700);
    expect(r.items[0].macros.proteinGrams).toBe(60);
  });

  it('preserves null macros as null (unknown stays unknown)', () => {
    const r = scaleComposition(
      { finalCalories: null, macros: { ...macros, proteinGrams: null }, items: [] },
      2,
    );
    expect(r.finalCalories).toBe(null);
    expect(r.macros.proteinGrams).toBe(null);
    expect(r.macros.fatGrams).toBe(20);
  });

  it('is decimal-safe (no float drift)', () => {
    const r = scaleComposition({ finalCalories: 100, macros: { ...macros, proteinGrams: 0.1 }, items: [] }, 3);
    expect(r.macros.proteinGrams).toBe(0.3); // not 0.30000000000000004
  });

  it('rejects non-positive or absurd multipliers', () => {
    expect(() => scaleComposition(base, 0)).toThrow();
    expect(() => scaleComposition(base, 25)).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test -- meal-scaling` → FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/meal-scaling.ts`:
```ts
import { Prisma } from '@prisma/client';

export interface MacroFields {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}
export interface ScalableItem {
  name: string;
  estimatedQuantity: string | null;
  finalCalories: number | null;
  macros: MacroFields;
}
export interface ScalableComposition {
  finalCalories: number | null;
  macros: MacroFields;
  items: ScalableItem[];
}

export const SERVING_PRESETS = [0.5, 1, 1.5, 2] as const;
const MAX_MULTIPLIER = 20;
const GRAM_KEYS = ['proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fiberGrams', 'sugarGrams', 'saturatedFatGrams'] as const;

/** Decimal * multiplier, 2dp. null -> null. */
function scaleGrams(value: number | null, m: Prisma.Decimal): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value).mul(m).toDecimalPlaces(2).toNumber();
}
/** Decimal * multiplier, rounded to int. null -> null. */
function scaleInt(value: number | null, m: Prisma.Decimal): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value).mul(m).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}
function scaleMacros(macros: MacroFields, m: Prisma.Decimal): MacroFields {
  const out = { sodiumMg: scaleInt(macros.sodiumMg, m) } as MacroFields;
  for (const key of GRAM_KEYS) out[key] = scaleGrams(macros[key], m);
  return out;
}

export function scaleComposition(base: ScalableComposition, multiplier: number): ScalableComposition {
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > MAX_MULTIPLIER) {
    throw new Error(`Invalid serving multiplier: ${multiplier}`);
  }
  const m = new Prisma.Decimal(multiplier);
  return {
    finalCalories: scaleInt(base.finalCalories, m),
    macros: scaleMacros(base.macros, m),
    items: base.items.map((i) => ({
      name: i.name,
      estimatedQuantity: i.estimatedQuantity,
      finalCalories: scaleInt(i.finalCalories, m),
      macros: scaleMacros(i.macros, m),
    })),
  };
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- meal-scaling` → PASS.
- [ ] **Step 5: Checkpoint** — scaling tests green.

---

### Task 4: Ranking helpers (`expectedMealTypeForNow`, `frequencyScore`)

**Files:**
- Create: `src/lib/meal-ranking.ts`
- Test: `tests/unit/meal-ranking.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function expectedMealTypeForHour(hour: number): MealType; // 0..23
  interface RankStats { usageCount: number; lastUsedAt: Date; groupMealType: MealType; }
  function frequencyScore(stats: RankStats, now: Date, expected: MealType): number;
  ```

- [ ] **Step 1: Write failing tests**

Create `tests/unit/meal-ranking.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { expectedMealTypeForHour, frequencyScore } from '@/lib/meal-ranking';

describe('expectedMealTypeForHour', () => {
  it('maps time of day to meal type', () => {
    expect(expectedMealTypeForHour(8)).toBe('BREAKFAST');
    expect(expectedMealTypeForHour(13)).toBe('LUNCH');
    expect(expectedMealTypeForHour(20)).toBe('DINNER');
    expect(expectedMealTypeForHour(3)).toBe('OTHER');
  });
});

describe('frequencyScore', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  it('rewards higher usage count', () => {
    const a = frequencyScore({ usageCount: 10, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'OTHER');
    const b = frequencyScore({ usageCount: 2, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'OTHER');
    expect(a).toBeGreaterThan(b);
  });
  it('decays with recency (older = lower)', () => {
    const recent = frequencyScore({ usageCount: 5, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'OTHER');
    const old = frequencyScore(
      { usageCount: 5, lastUsedAt: new Date('2026-07-01T12:00:00Z'), groupMealType: 'LUNCH' }, now, 'OTHER');
    expect(recent).toBeGreaterThan(old);
  });
  it('boosts meals matching the expected type for now', () => {
    const match = frequencyScore({ usageCount: 5, lastUsedAt: now, groupMealType: 'LUNCH' }, now, 'LUNCH');
    const noMatch = frequencyScore({ usageCount: 5, lastUsedAt: now, groupMealType: 'DINNER' }, now, 'LUNCH');
    expect(match).toBeGreaterThan(noMatch);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test -- meal-ranking` → FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/meal-ranking.ts`:
```ts
import type { MealType } from '@prisma/client';

const HALF_LIFE_DAYS = 14;
const CONTEXT_MULTIPLIER = 1.5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Ώρα ημέρας -> αναμενόμενος τύπος γεύματος (στο timezone του χρήστη). */
export function expectedMealTypeForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'BREAKFAST';
  if (hour >= 11 && hour < 12.5) return 'MORNING_SNACK';
  if (hour >= 12.5 && hour < 16) return 'LUNCH';
  if (hour >= 16 && hour < 18.5) return 'AFTERNOON_SNACK';
  if (hour >= 18.5 && hour < 23) return 'DINNER';
  return 'OTHER';
}

export interface RankStats {
  usageCount: number;
  lastUsedAt: Date;
  groupMealType: MealType;
}

/** score = ln(1+count) * (0.5 + 0.5*recency) * contextMult, recency=0.5^(days/14). */
export function frequencyScore(stats: RankStats, now: Date, expected: MealType): number {
  const days = Math.max(0, (now.getTime() - stats.lastUsedAt.getTime()) / DAY_MS);
  const recency = Math.pow(0.5, days / HALF_LIFE_DAYS);
  const contextMult = stats.groupMealType === expected ? CONTEXT_MULTIPLIER : 1;
  return Math.log(1 + stats.usageCount) * (0.5 + 0.5 * recency) * contextMult;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- meal-ranking` → PASS.
- [ ] **Step 5: Checkpoint** — ranking tests green.

---

## Phase 3 — Services

### Task 5: Wire fingerprint into meal writes + `source` override

**Files:**
- Modify: `src/server/services/meal.ts` (`createManualMeal`, `confirmMeal`, `updateMeal`; add `deriveFingerprint` helper)
- Modify: `src/lib/validation/meal.ts` (`manualMealSchema` — no change needed; `createManualMeal` gains a param)
- Test: `tests/unit/meal-fingerprint-wiring.test.ts`

**Interfaces:**
- Consumes: `computeMealFingerprint` (Task 2).
- Produces: `createManualMeal(params: { userId; input: ManualMealInput; timezone; source?: MealSource })`; meals written/confirmed carry `mealFingerprint`.

- [ ] **Step 1: Add a fingerprint helper in `meal.ts`**

After the imports in `src/server/services/meal.ts`, add:
```ts
import { computeMealFingerprint } from '@/lib/meal-fingerprint';
```
Add near the top-level helpers:
```ts
/** Fingerprint από την τρέχουσα σύνθεση ενός γεύματος (title/type/items/total). */
function deriveFingerprint(params: {
  title: string | null;
  mealType: MealType;
  finalCalories: number | null;
  items: Array<{ name: string; finalCalories: number | null }>;
}): string {
  return computeMealFingerprint({
    title: params.title,
    mealType: params.mealType,
    totalCalories: params.finalCalories,
    items: params.items.map((i) => ({ name: i.name, calories: i.finalCalories })),
  });
}
```

- [ ] **Step 2: Set fingerprint + source in `createManualMeal`**

Change the signature to accept `source`:
```ts
export async function createManualMeal(params: {
  userId: string;
  input: ManualMealInput;
  timezone: string;
  source?: MealSource;
}): Promise<CreateMealResult> {
  const { userId, input, timezone, source = 'MANUAL' } = params;
```
In the `prisma.meal.create` `data`, replace `source: 'MANUAL',` with `source,` and add after `finalCalories: total,`:
```ts
        mealFingerprint: deriveFingerprint({
          title: input.title || null,
          mealType: input.mealType,
          finalCalories: total,
          items: items.map((i) => ({ name: i.name, finalCalories: normalizeCalories(i.finalCalories) })),
        }),
```

- [ ] **Step 3: Set fingerprint in `confirmMeal`**

In `confirmMeal`, widen the initial `select` to include composition, then set the fingerprint at confirmation:
```ts
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, userId },
    select: {
      id: true, status: true, finalCalories: true, title: true, mealType: true,
      items: { select: { name: true, finalCalories: true } },
    },
  });
```
Replace the final update with:
```ts
  await prisma.meal.update({
    where: { id: mealId },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      mealFingerprint: deriveFingerprint({
        title: meal.title,
        mealType: meal.mealType,
        finalCalories: meal.finalCalories,
        items: meal.items,
      }),
    },
  });
```

- [ ] **Step 4: Recompute fingerprint in `updateMeal` when composition changes**

At the end of `updateMeal`, inside the `$transaction` after `tx.meal.update({ where: { id: mealId }, data })`, add a recompute for CONFIRMED meals whose composition may have shifted:
```ts
    const fresh = await tx.meal.findUnique({
      where: { id: mealId },
      select: {
        status: true, title: true, mealType: true, finalCalories: true,
        items: { select: { name: true, finalCalories: true } },
      },
    });
    if (fresh && fresh.status === 'CONFIRMED') {
      await tx.meal.update({
        where: { id: mealId },
        data: {
          mealFingerprint: deriveFingerprint({
            title: fresh.title, mealType: fresh.mealType,
            finalCalories: fresh.finalCalories, items: fresh.items,
          }),
        },
      });
    }
```

- [ ] **Step 5: Write the wiring test**

Create `tests/unit/meal-fingerprint-wiring.test.ts` — mock `prisma` from `@/server/db/prisma` and assert `createManualMeal` computes the same fingerprint as `computeMealFingerprint` for a known input and passes `source` through. (Follow the existing mock style in `tests/unit/meal-service.test.ts`.)
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computeMealFingerprint } from '@/lib/meal-fingerprint';

const create = vi.fn();
vi.mock('@/server/db/prisma', () => ({
  prisma: {
    meal: { findFirst: vi.fn().mockResolvedValue(null), create, findUnique: vi.fn() },
  },
}));
vi.mock('@/server/auth/rate-limit', () => ({ assertUploadRateLimit: vi.fn(), assertAiRateLimit: vi.fn() }));

beforeEach(() => { create.mockReset(); create.mockResolvedValue({ id: 'm1' }); });

it('stores fingerprint and honours source override', async () => {
  const { createManualMeal } = await import('@/server/services/meal');
  // getMealForUser reads back the meal; stub prisma.meal.findFirst for the read.
  // (See meal-service.test.ts for the full read-back stub pattern.)
  const input = { mealType: 'LUNCH', mealDateTime: '2026-08-06T12:00', title: 'Κοτόπουλο', items: [{ name: 'Κοτόπουλο', finalCalories: 350 }], acknowledgeHighCalories: false } as never;
  await createManualMeal({ userId: 'u1', input, timezone: 'Europe/Athens', source: 'SAVED_MEAL' }).catch(() => {});
  const data = create.mock.calls[0][0].data;
  expect(data.source).toBe('SAVED_MEAL');
  expect(data.mealFingerprint).toBe(
    computeMealFingerprint({ title: 'Κοτόπουλο', mealType: 'LUNCH', totalCalories: 350, items: [{ name: 'Κοτόπουλο', calories: 350 }] }),
  );
});
```

- [ ] **Step 6: Run — verify fail then implement is already done; run to pass**

Run: `npm test -- meal-fingerprint-wiring meal-service`
Expected: PASS (and existing meal-service tests still green).

- [ ] **Step 7: Checkpoint** — wiring + existing meal-service tests green.

---

### Task 6: `meal-history` service (frequent / recent / favorites / quick-pick)

**Files:**
- Create: `src/server/services/meal-history.ts`
- Test: `tests/unit/meal-history.test.ts`

**Interfaces:**
- Consumes: `prisma`, `MEAL_SELECT`, `toMealView`, `MealView`, `createManualMeal` (Task 5), `scaleComposition` (Task 3), `frequencyScore`/`expectedMealTypeForHour` (Task 4), `getStorage`, `buildMealImageKey`.
- Produces:
  ```ts
  type QuickPickRef = { kind: 'favorite'; id: string } | { kind: 'frequent'; fingerprint: string } | { kind: 'recent'; mealId: string };
  interface FrequentMealView { fingerprint: string; usageCount: number; lastUsedAt: string; isFavorite: boolean; meal: MealView; }
  interface FavoriteMealView { id: string; fingerprint: string; title: string | null; mealType: MealType; calories: number | null; macros: MacroView; itemCount: number; thumbUrl: string | null; }
  function getRecentMeals(userId: string, limit?: number): Promise<MealView[]>;
  function getFrequentMeals(userId: string, opts: { now: Date; hour: number; limit?: number }): Promise<FrequentMealView[]>;
  function getFavorites(userId: string): Promise<FavoriteMealView[]>;
  function resolveComposition(userId: string, ref: QuickPickRef): Promise<ScalableComposition & { title: string | null; mealType: MealType; thumbSourceMealId: string | null }>;
  function previewQuickPick(userId: string, ref: QuickPickRef, multiplier: number): Promise<{ title: string | null; mealType: MealType; multiplier: number; composition: ScalableComposition }>;
  function createQuickPick(userId: string, params: { ref: QuickPickRef; servingMultiplier: number; overrides?: Partial<MacroFields> & { finalCalories?: number }; mealType: MealType; notes?: string; requestKey?: string }, timezone: string): Promise<CreateMealResult>;
  function addFavorite(userId: string, ref: QuickPickRef): Promise<FavoriteMealView>;
  function removeFavorite(userId: string, favoriteId: string): Promise<void>;
  function getFavoriteThumb(userId: string, favoriteId: string): Promise<{ body: Buffer; contentType: string }>;
  ```

- [ ] **Step 1: Write failing tests** (service-level, mocked prisma — mirror `tests/unit/meal-service.test.ts`)

Create `tests/unit/meal-history.test.ts` covering:
```ts
// user isolation: every prisma call includes userId in where
// getRecentMeals: only CONFIRMED, ordered mealDateTime desc, respects limit
// getFrequentMeals: orders by frequencyScore (assert a high-count-recent group ranks above a stale one)
// resolveComposition: 'recent' ref for another user's meal -> throws NOT_FOUND (IDOR)
// previewQuickPick: multiplier applied via scaleComposition (calories halved at 0.5)
// createQuickPick: calls createManualMeal with source 'SAVED_MEAL', mealDateTime=now, requestKey passthrough
//   and does NOT import/call the AI module
// addFavorite: idempotent on [userId, fingerprint]
```
(Write concrete assertions using `vi.fn()` mocks for `prisma.$queryRaw`, `prisma.meal.*`, `prisma.favoriteMeal.*`, and a spy on `createManualMeal`.)

- [ ] **Step 2: Run to verify fail** — `npm test -- meal-history` → FAIL.

- [ ] **Step 3: Implement the service**

Create `src/server/services/meal-history.ts`:
```ts
import 'server-only';
import { Prisma, type MealType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { getStorage, buildMealImageKey } from '../storage';
import { MEAL_SELECT, toMealView, type MealView, type MacroView, createManualMeal, type CreateMealResult, COUNTED_MEAL_STATUS } from './meal';
import { scaleComposition, type ScalableComposition, type MacroFields } from '@/lib/meal-scaling';
import { frequencyScore, expectedMealTypeForHour } from '@/lib/meal-ranking';
import { normalizeCalories, isAboveSoftLimit } from '@/lib/calories';

export type QuickPickRef =
  | { kind: 'favorite'; id: string }
  | { kind: 'frequent'; fingerprint: string }
  | { kind: 'recent'; mealId: string };

export interface FrequentMealView { fingerprint: string; usageCount: number; lastUsedAt: string; isFavorite: boolean; meal: MealView; }
export interface FavoriteMealView { id: string; fingerprint: string; title: string | null; mealType: MealType; calories: number | null; macros: MacroView; itemCount: number; thumbUrl: string | null; }

const RECENT_LIMIT = 8;
const FREQUENT_LIMIT = 12;

export async function getRecentMeals(userId: string, limit = RECENT_LIMIT): Promise<MealView[]> {
  const meals = await prisma.meal.findMany({
    where: { userId, status: COUNTED_MEAL_STATUS },
    orderBy: { mealDateTime: 'desc' },
    take: limit,
    select: MEAL_SELECT,
  });
  return meals.map(toMealView);
}

interface AggRow { fingerprint: string; usageCount: number; lastUsedAt: Date; representativeId: string; groupMealType: MealType; }

export async function getFrequentMeals(
  userId: string,
  opts: { now: Date; hour: number; limit?: number },
): Promise<FrequentMealView[]> {
  // Aggregate per fingerprint (userId-scoped, CONFIRMED only).
  const rows = await prisma.$queryRaw<AggRow[]>`
    SELECT "mealFingerprint" AS fingerprint,
           COUNT(*)::int AS "usageCount",
           MAX("mealDateTime") AS "lastUsedAt",
           (ARRAY_AGG("id" ORDER BY "mealDateTime" DESC))[1] AS "representativeId",
           (ARRAY_AGG("mealType" ORDER BY "mealDateTime" DESC))[1] AS "groupMealType"
    FROM "meals"
    WHERE "userId" = ${userId} AND "status" = 'CONFIRMED' AND "mealFingerprint" IS NOT NULL
    GROUP BY "mealFingerprint"
  `;
  if (rows.length === 0) return [];

  const expected = expectedMealTypeForHour(opts.hour);
  const ranked = rows
    .map((r) => ({ row: r, score: frequencyScore({ usageCount: r.usageCount, lastUsedAt: r.lastUsedAt, groupMealType: r.groupMealType }, opts.now, expected) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? FREQUENT_LIMIT);

  const ids = ranked.map((r) => r.row.representativeId);
  const [meals, favs] = await Promise.all([
    prisma.meal.findMany({ where: { id: { in: ids }, userId }, select: MEAL_SELECT }),
    prisma.favoriteMeal.findMany({ where: { userId, fingerprint: { in: rows.map((r) => r.fingerprint) } }, select: { fingerprint: true } }),
  ]);
  const mealById = new Map(meals.map((m) => [m.id, toMealView(m)]));
  const favSet = new Set(favs.map((f) => f.fingerprint));

  return ranked
    .map(({ row }) => {
      const meal = mealById.get(row.representativeId);
      if (!meal) return null;
      return { fingerprint: row.fingerprint, usageCount: row.usageCount, lastUsedAt: row.lastUsedAt.toISOString(), isFavorite: favSet.has(row.fingerprint), meal };
    })
    .filter((v): v is FrequentMealView => v !== null);
}

function favToView(fav: { id: string; fingerprint: string; title: string | null; mealType: MealType; calories: number | null; items: Prisma.JsonValue; thumbKey: string | null; proteinGrams: Prisma.Decimal | null; carbohydrateGrams: Prisma.Decimal | null; fatGrams: Prisma.Decimal | null; fiberGrams: Prisma.Decimal | null; sugarGrams: Prisma.Decimal | null; saturatedFatGrams: Prisma.Decimal | null; sodiumMg: number | null }): FavoriteMealView {
  const d = (v: Prisma.Decimal | null) => (v === null ? null : v.toNumber());
  return {
    id: fav.id, fingerprint: fav.fingerprint, title: fav.title, mealType: fav.mealType, calories: fav.calories,
    macros: { proteinGrams: d(fav.proteinGrams), carbohydrateGrams: d(fav.carbohydrateGrams), fatGrams: d(fav.fatGrams), fiberGrams: d(fav.fiberGrams), sugarGrams: d(fav.sugarGrams), saturatedFatGrams: d(fav.saturatedFatGrams), sodiumMg: fav.sodiumMg },
    itemCount: Array.isArray(fav.items) ? fav.items.length : 0,
    thumbUrl: fav.thumbKey ? `/api/meals/favorites/${fav.id}/image` : null,
  };
}

export async function getFavorites(userId: string): Promise<FavoriteMealView[]> {
  const favs = await prisma.favoriteMeal.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  return favs.map(favToView);
}

// resolveComposition / previewQuickPick / createQuickPick / addFavorite / removeFavorite / getFavoriteThumb
// follow below (Steps 4-8).
```

- [ ] **Step 4: Add `resolveComposition`** (the userId-scoped base loader — anti-IDOR)

Append to the service:
```ts
interface ResolvedBase extends ScalableComposition { title: string | null; mealType: MealType; thumbSourceMealId: string | null; }

function mealViewToComposition(m: MealView): ScalableComposition {
  return {
    finalCalories: m.finalCalories,
    macros: m.macros,
    items: m.items.map((i) => ({ name: i.name, estimatedQuantity: i.estimatedQuantity, finalCalories: i.finalCalories, macros: i.macros })),
  };
}

export async function resolveComposition(userId: string, ref: QuickPickRef): Promise<ResolvedBase> {
  if (ref.kind === 'favorite') {
    const fav = await prisma.favoriteMeal.findFirst({ where: { id: ref.id, userId } });
    if (!fav) throw new ApiError('NOT_FOUND', 'Το αγαπημένο γεύμα δεν βρέθηκε.');
    const items = (Array.isArray(fav.items) ? fav.items : []) as ScalableComposition['items'];
    const d = (v: Prisma.Decimal | null) => (v === null ? null : v.toNumber());
    return {
      title: fav.title, mealType: fav.mealType, thumbSourceMealId: null,
      finalCalories: fav.calories,
      macros: { proteinGrams: d(fav.proteinGrams), carbohydrateGrams: d(fav.carbohydrateGrams), fatGrams: d(fav.fatGrams), fiberGrams: d(fav.fiberGrams), sugarGrams: d(fav.sugarGrams), saturatedFatGrams: d(fav.saturatedFatGrams), sodiumMg: fav.sodiumMg },
      items,
    };
  }
  const where = ref.kind === 'recent'
    ? { id: ref.mealId, userId, status: COUNTED_MEAL_STATUS }
    : { userId, status: COUNTED_MEAL_STATUS, mealFingerprint: ref.fingerprint };
  const meal = await prisma.meal.findFirst({ where, orderBy: { mealDateTime: 'desc' }, select: MEAL_SELECT });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  const view = toMealView(meal);
  return { ...mealViewToComposition(view), title: view.title, mealType: view.mealType, thumbSourceMealId: view.hasImage ? view.id : null };
}
```

- [ ] **Step 5: Add `previewQuickPick`**

```ts
export async function previewQuickPick(userId: string, ref: QuickPickRef, multiplier: number) {
  const base = await resolveComposition(userId, ref);
  const composition = scaleComposition({ finalCalories: base.finalCalories, macros: base.macros, items: base.items }, multiplier);
  return { title: base.title, mealType: base.mealType, multiplier, composition };
}
```

- [ ] **Step 6: Add `createQuickPick`** (backend-authoritative scaling, no AI, independent copy)

```ts
export async function createQuickPick(
  userId: string,
  params: { ref: QuickPickRef; servingMultiplier: number; overrides?: Partial<MacroFields> & { finalCalories?: number }; mealType: MealType; notes?: string; requestKey?: string },
  timezone: string,
): Promise<CreateMealResult> {
  const base = await resolveComposition(userId, params.ref);
  const scaled = scaleComposition({ finalCalories: base.finalCalories, macros: base.macros, items: base.items }, params.servingMultiplier);
  const o = params.overrides ?? {};
  const finalCalories = o.finalCalories ?? scaled.finalCalories ?? undefined;
  const macro = (k: keyof MacroFields) => (o[k] !== undefined ? o[k] : scaled.macros[k]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  // localDateTimeToUtc expects 'YYYY-MM-DDTHH:mm' in the user's tz; build from `now` in that tz.
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (t: string) => local.find((p) => p.type === t)!.value;
  const mealDateTime = `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;

  const input = {
    mealType: params.mealType,
    mealDateTime,
    title: base.title ?? undefined,
    notes: params.notes,
    finalCalories,
    items: scaled.items.map((i) => ({ name: i.name, estimatedQuantity: i.estimatedQuantity ?? undefined, finalCalories: i.finalCalories ?? 0, ...i.macros })),
    proteinGrams: macro('proteinGrams'), carbohydrateGrams: macro('carbohydrateGrams'), fatGrams: macro('fatGrams'),
    fiberGrams: macro('fiberGrams'), sugarGrams: macro('sugarGrams'), saturatedFatGrams: macro('saturatedFatGrams'), sodiumMg: macro('sodiumMg'),
    acknowledgeHighCalories: finalCalories !== undefined ? isAboveSoftLimit(normalizeCalories(finalCalories)) : false,
    requestKey: params.requestKey,
  } as Parameters<typeof createManualMeal>[0]['input'];

  logger.info('quick_pick_create', { userId, kind: params.ref.kind, multiplier: params.servingMultiplier });
  return createManualMeal({ userId, input, timezone, source: 'SAVED_MEAL' });
}
```
> Note: `acknowledgeHighCalories` is auto-set here because the preview already showed the user the (possibly scaled) value and they confirmed; the soft-limit guard would otherwise reject legitimate large confirmed portions.

- [ ] **Step 7: Add `addFavorite` / `removeFavorite` / `getFavoriteThumb`**

```ts
export async function addFavorite(userId: string, ref: QuickPickRef): Promise<FavoriteMealView> {
  const base = await resolveComposition(userId, ref);
  const fingerprint = ref.kind === 'frequent' ? ref.fingerprint : await fingerprintForBase(userId, ref, base);

  const existing = await prisma.favoriteMeal.findUnique({ where: { userId_fingerprint: { userId, fingerprint } } });
  if (existing) return favToView(existing);

  let thumbKey: string | null = null;
  if (base.thumbSourceMealId) thumbKey = await copyThumb(userId, base.thumbSourceMealId);

  const dec = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
  const fav = await prisma.favoriteMeal.create({
    data: {
      userId, fingerprint, title: base.title, mealType: base.mealType, calories: base.finalCalories ?? null,
      proteinGrams: dec(base.macros.proteinGrams), carbohydrateGrams: dec(base.macros.carbohydrateGrams), fatGrams: dec(base.macros.fatGrams),
      fiberGrams: dec(base.macros.fiberGrams), sugarGrams: dec(base.macros.sugarGrams), saturatedFatGrams: dec(base.macros.saturatedFatGrams), sodiumMg: base.macros.sodiumMg ?? null,
      items: base.items as unknown as Prisma.InputJsonValue, thumbKey,
    },
  });
  return favToView(fav);
}

async function fingerprintForBase(userId: string, ref: QuickPickRef, base: ResolvedBase): Promise<string> {
  const { computeMealFingerprint } = await import('@/lib/meal-fingerprint');
  return computeMealFingerprint({ title: base.title, mealType: base.mealType, totalCalories: base.finalCalories, items: base.items.map((i) => ({ name: i.name, calories: i.finalCalories })) });
}

async function copyThumb(userId: string, sourceMealId: string): Promise<string | null> {
  const meal = await prisma.meal.findFirst({ where: { id: sourceMealId, userId }, select: { thumbPath: true, imageMimeType: true } });
  if (!meal?.thumbPath) return null;
  const storage = getStorage();
  try {
    const body = await storage.get(meal.thumbPath);
    const key = buildMealImageKey(userId, meal.imageMimeType ?? 'image/webp', 'thumb');
    await storage.put(key, body, 'image/webp');
    return key;
  } catch { return null; }
}

export async function removeFavorite(userId: string, favoriteId: string): Promise<void> {
  const fav = await prisma.favoriteMeal.findFirst({ where: { id: favoriteId, userId }, select: { id: true, thumbKey: true } });
  if (!fav) throw new ApiError('NOT_FOUND', 'Το αγαπημένο δεν βρέθηκε.');
  await prisma.favoriteMeal.delete({ where: { id: fav.id } });
  if (fav.thumbKey) { try { await getStorage().delete(fav.thumbKey); } catch { /* best-effort */ } }
}

export async function getFavoriteThumb(userId: string, favoriteId: string): Promise<{ body: Buffer; contentType: string }> {
  const fav = await prisma.favoriteMeal.findFirst({ where: { id: favoriteId, userId }, select: { thumbKey: true } });
  if (!fav?.thumbKey) throw new ApiError('NOT_FOUND', 'Δεν υπάρχει εικόνα.');
  return { body: await getStorage().get(fav.thumbKey), contentType: 'image/webp' };
}
```

- [ ] **Step 8: Run tests to pass** — `npm test -- meal-history` → PASS.
- [ ] **Step 9: Checkpoint** — meal-history service tests green; `npx tsc --noEmit` clean.

---

## Phase 4 — API routes & history filter

### Task 7: Rate-limit helper + validation schemas

**Files:**
- Modify: `src/server/auth/rate-limit.ts` (add `assertQuickPickRateLimit`)
- Modify: `src/lib/validation/meal.ts` (add quick-pick + favorite schemas; add `minCalories`/`maxCalories` to history query)
- Test: `tests/unit/validation.test.ts` (extend)

**Interfaces:**
- Produces: `assertQuickPickRateLimit(userId): void`; `quickPickPreviewSchema`, `quickPickCreateSchema`, `favoriteRefSchema`; `mealHistoryQuerySchema` gains `minCalories?`, `maxCalories?`.

- [ ] **Step 1: Add the rate limiter**

Append to `src/server/auth/rate-limit.ts`:
```ts
/** Όριο quick-pick δημιουργιών ανά χρήστη (in-memory sliding window). */
export function assertQuickPickRateLimit(userId: string): void {
  if (hitLimit(`quickpick:${userId}`, 60, 60 * 1000)) {
    throw new ApiError('RATE_LIMITED', 'Πολλές γρήγορες προσθήκες. Δοκίμασε ξανά σε λίγο.');
  }
}
```

- [ ] **Step 2: Add the Zod schemas**

Append to `src/lib/validation/meal.ts`:
```ts
export const quickPickRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('favorite'), id: z.string().cuid() }),
  z.object({ kind: z.literal('frequent'), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ kind: z.literal('recent'), mealId: z.string().cuid() }),
]);

const servingMultiplier = z.coerce.number().positive().max(20);

export const quickPickPreviewSchema = z.object({ ref: quickPickRefSchema, servingMultiplier: servingMultiplier.default(1) });

export const quickPickCreateSchema = z.object({
  ref: quickPickRefSchema,
  servingMultiplier: servingMultiplier.default(1),
  mealType: z.enum(MEAL_TYPES),
  notes: z.string().trim().max(500).optional(),
  overrides: macroFieldsSchema.extend({ finalCalories: calorieField.optional() }).partial().optional(),
  requestKey: z.string().trim().min(8).max(64).optional(),
});

export const favoriteCreateSchema = z.object({ ref: quickPickRefSchema });
```
Extend `mealHistoryQuerySchema` with:
```ts
  minCalories: z.coerce.number().int().min(0).optional(),
  maxCalories: z.coerce.number().int().min(0).optional(),
```

- [ ] **Step 3: Extend `listMealHistory`** to honour calorie range

In `src/server/services/meal.ts` `listMealHistory`, after the mealType filter add:
```ts
  if (query.minCalories !== undefined || query.maxCalories !== undefined) {
    const range: Prisma.IntNullableFilter = {};
    if (query.minCalories !== undefined) range.gte = query.minCalories;
    if (query.maxCalories !== undefined) range.lte = query.maxCalories;
    where.finalCalories = range;
  }
```
And widen `HistoryQuery` with `minCalories?: number; maxCalories?: number;`.

- [ ] **Step 4: Test + run** — extend `tests/unit/validation.test.ts` with a quick-pick create parse (valid + invalid ref) and a history calorie-range parse. Run `npm test -- validation` → PASS.
- [ ] **Step 5: Checkpoint.**

---

### Task 8: GET routes — frequent / recent / favorites

**Files:**
- Create: `src/app/api/meals/frequent/route.ts`, `src/app/api/meals/recent/route.ts`, `src/app/api/meals/favorites/route.ts`
- Test: `tests/unit/meal-history-routes.test.ts` (optional integration; core logic covered in Task 6)

**Interfaces:** Consumes Task 6 service + `requireApiUser` + `getUserTimezone`.

- [ ] **Step 1: `recent` route**

Create `src/app/api/meals/recent/route.ts`:
```ts
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getRecentMeals } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? 8);
  const meals = await getRecentMeals(user.id, Math.min(Math.max(limit, 1), 20));
  return jsonOk({ meals });
});
```

- [ ] **Step 2: `frequent` route** (computes `now`/`hour` in user tz server-side)

Create `src/app/api/meals/frequent/route.ts`:
```ts
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getUserTimezone } from '@/server/services/profile';
import { getFrequentMeals } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  const timezone = await getUserTimezone(user.id);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(now));
  const meals = await getFrequentMeals(user.id, { now, hour });
  return jsonOk({ meals });
});
```

- [ ] **Step 3: `favorites` GET route** (shares file with POST in Task 10 — create GET now)

Create `src/app/api/meals/favorites/route.ts`:
```ts
import { jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getFavorites } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async () => {
  const user = await requireApiUser();
  return jsonOk({ favorites: await getFavorites(user.id) });
});
```

- [ ] **Step 4: Checkpoint** — `npx tsc --noEmit` clean; hit each route manually against a seeded user returns 200.

---

### Task 9: POST quick-pick preview + create

**Files:**
- Create: `src/app/api/meals/quick-pick/preview/route.ts`, `src/app/api/meals/quick-pick/route.ts`

**Interfaces:** Consumes Task 6 + Task 7 schemas + `assertQuickPickRateLimit` + `requireWriteAccess`.

- [ ] **Step 1: preview route**

Create `src/app/api/meals/quick-pick/preview/route.ts`:
```ts
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { quickPickPreviewSchema } from '@/lib/validation/meal';
import { previewQuickPick } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { ref, servingMultiplier } = quickPickPreviewSchema.parse(await request.json());
  return jsonOk(await previewQuickPick(user.id, ref, servingMultiplier));
});
```

- [ ] **Step 2: create route**

Create `src/app/api/meals/quick-pick/route.ts`:
```ts
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser, requireWriteAccess } from '@/server/auth/guards';
import { assertQuickPickRateLimit } from '@/server/auth/rate-limit';
import { getUserTimezone } from '@/server/services/profile';
import { quickPickCreateSchema } from '@/lib/validation/meal';
import { createQuickPick } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  await requireWriteAccess(user.id);
  assertQuickPickRateLimit(user.id);
  const input = quickPickCreateSchema.parse(await request.json());
  const timezone = await getUserTimezone(user.id);
  const { meal, duplicated } = await createQuickPick(user.id, input, timezone);
  return jsonOk({ meal, duplicated }, duplicated ? 200 : 201);
});
```

- [ ] **Step 3: Checkpoint** — a quick-pick create returns 201 and a second call with the same `requestKey` returns 200 with the same meal id (idempotent). Verify no AI usage log row was written.

---

### Task 10: Favorites POST/DELETE + favorite image route

**Files:**
- Modify: `src/app/api/meals/favorites/route.ts` (add POST)
- Create: `src/app/api/meals/favorites/[id]/route.ts` (DELETE), `src/app/api/meals/favorites/[id]/image/route.ts` (GET)

**Interfaces:** Consumes Task 6 (`addFavorite`, `removeFavorite`, `getFavoriteThumb`) + `favoriteCreateSchema`.

- [ ] **Step 1: Add POST to favorites route**

Append to `src/app/api/meals/favorites/route.ts`:
```ts
import { assertSameOrigin, ApiError } from '@/server/http';
import { favoriteCreateSchema } from '@/lib/validation/meal';
import { addFavorite } from '@/server/services/meal-history';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { ref } = favoriteCreateSchema.parse(await request.json());
  return jsonOk({ favorite: await addFavorite(user.id, ref) }, 201);
});
```

- [ ] **Step 2: DELETE route**

Create `src/app/api/meals/favorites/[id]/route.ts`:
```ts
import { assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { removeFavorite } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withErrorHandling(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const { id } = await params;
  await removeFavorite(user.id, id);
  return jsonOk({ ok: true });
});
```

- [ ] **Step 3: favorite image route** (mirror `src/app/api/meals/[id]/image/route.ts`)

Create `src/app/api/meals/favorites/[id]/image/route.ts`:
```ts
import { withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { getFavoriteThumb } from '@/server/services/meal-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const { body, contentType } = await getFavoriteThumb(user.id, id);
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' } });
});
```
> Match the exact `Response` shape used by `src/app/api/meals/[id]/image/route.ts` (check it before writing).

- [ ] **Step 4: Checkpoint** — favorite create/delete/image round-trip works; user B gets `NOT_FOUND` on user A's favorite id (IDOR).

---

## Phase 5 — UI

### Task 11: i18n strings

**Files:** Modify `src/i18n/el.ts`, `src/i18n/en.ts`.

- [ ] **Step 1:** Add an `addMeal` block to `el.ts` (and mirror in `en.ts`):
```ts
  addMeal: {
    title: 'Προσθήκη γεύματος',
    favorites: 'Αγαπημένα',
    frequent: 'Συχνά γεύματα',
    recent: 'Πρόσφατα γεύματα',
    frequentEmpty: 'Τα γεύματα που χρησιμοποιείς συχνά θα εμφανίζονται εδώ.',
    favoritesEmpty: 'Δεν έχεις αγαπημένα ακόμη.',
    recentEmpty: 'Δεν υπάρχουν πρόσφατα γεύματα.',
    photoOption: 'Φωτογραφία',
    manualOption: 'Χειροκίνητα',
    add: 'Προσθήκη',
    usedTimes: '{count}× χρήσεις',
    lastUsed: 'Τελευταία: {when}',
    saveFavorite: 'Αποθήκευση στα αγαπημένα',
    removeFavorite: 'Αφαίρεση από αγαπημένα',
    searchPlaceholder: 'Αναζήτηση στο ιστορικό…',
    servings: 'Μερίδες',
    custom: 'Προσαρμοσμένη',
    confirmAdd: 'Καταχώριση',
    added: 'Το γεύμα προστέθηκε.',
    loadMore: 'Φόρτωσε περισσότερα',
  },
```
- [ ] **Step 2: Checkpoint** — `npx tsc --noEmit` clean (i18n `en` must structurally mirror `el`).

---

### Task 12: `/meals/add` hub page + section cards

**Files:**
- Create: `src/app/(app)/meals/add/page.tsx` (RSC — fetches all three sections in parallel)
- Create: `src/components/meal/quick-pick-section.tsx`, `src/components/meal/quick-pick-card.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx:176` (change `href="/meals/new"` → `href="/meals/add"`)

**Interfaces:** Consumes Task 6 service views; renders client cards that open the preview (Task 13).

- [ ] **Step 1: Hub page (RSC)**

Create `src/app/(app)/meals/add/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, PencilLine, ChevronLeft } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile, getUserTimezone } from '@/server/services/profile';
import { getFavorites, getFrequentMeals, getRecentMeals } from '@/server/services/meal-history';
import { QuickPickSection } from '@/components/meal/quick-pick-section';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('addMeal.title') };
}
export const dynamic = 'force-dynamic';

export default async function AddMealPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');
  const timezone = await getUserTimezone(user.id);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(now));

  const [favorites, frequent, recent] = await Promise.all([
    getFavorites(user.id),
    getFrequentMeals(user.id, { now, hour }),
    getRecentMeals(user.id),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t('common.back')}
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{t('addMeal.title')}</h1>

      <QuickPickSection kind="favorites" favorites={favorites} frequent={frequent} recent={recent} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/meals/new" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
          <Camera className="h-5 w-5" aria-hidden="true" /> {t('addMeal.photoOption')}
        </Link>
        <Link href="/meals/manual" className="flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold">
          <PencilLine className="h-5 w-5" aria-hidden="true" /> {t('addMeal.manualOption')}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Client section + card**

Create `src/components/meal/quick-pick-section.tsx` — a `'use client'` component that renders the three ordered sections (Favorites → Frequent → Recent), each a horizontal-scroll list of `QuickPickCard`, with skeletons while the preview loads and empty states from `addMeal.*Empty`. Create `src/components/meal/quick-pick-card.tsx` showing title, meal-type badge, thumbnail (`meal.thumbUrl`/`favorite.thumbUrl` served with auth), calories, P/C/F, usage count, last-used (relative), a favorite toggle button, and an "Προσθήκη" button that calls `onPick(ref, defaults)` to open the preview drawer (Task 13). Follow existing card styling in `src/components/meal/meal-card.tsx`.
> Reuse `meal-card.tsx` visual language; keep each new file focused (section = layout/state, card = presentation).

- [ ] **Step 3: Point the dashboard button at the hub**

In `src/app/(app)/dashboard/page.tsx`, change the primary Add-Meal link `href="/meals/new"` → `href="/meals/add"`.

- [ ] **Step 4: Checkpoint** — hub renders all three sections with data + empty states; `npx tsc --noEmit` clean.

---

### Task 13: Quick-pick preview drawer

**Files:**
- Create: `src/components/meal/quick-pick-preview.tsx`

**Interfaces:** Consumes `/api/meals/quick-pick/preview` + `/api/meals/quick-pick`; `SERVING_PRESETS` from `@/lib/meal-scaling`.

- [ ] **Step 1:** Build a `'use client'` drawer/modal that:
  - On open (given a `QuickPickRef`), POSTs to `/preview` with `servingMultiplier=1`, shows skeleton, renders the scaled composition.
  - Portion presets `0.5 / 1 / 1.5 / 2 / custom` (from `SERVING_PRESETS`); changing the preset re-POSTs `/preview` (backend-authoritative scaling) and updates the shown calories/macros.
  - Editable fields: `mealType` (select), `finalCalories`, macros, `notes`. Edits populate `overrides`.
  - Generates a stable `requestKey` (e.g. `crypto.randomUUID()`) once per open for idempotency.
  - "Καταχώριση" → POST `/quick-pick` with `{ ref, servingMultiplier, overrides, mealType, notes, requestKey }`; on success show a toast (`addMeal.added`) and refresh/close; on `RATE_LIMITED`/error show the message.
  - Confirmation required before the POST (the button IS the confirmation; disable while pending).
  Follow the form primitives in `src/components/meal/manual-meal-form.tsx` and the toast pattern already in the app.
- [ ] **Step 2: Checkpoint** — pick a frequent meal, scale to 0.5, confirm; a new independent CONFIRMED meal appears for today; editing the original later does not change it.

---

### Task 14: History search + infinite scroll + favorite toggle on detail

**Files:**
- Create: `src/components/meal/history-search.tsx` (client; used on the hub)
- Modify: `src/app/(app)/meals/add/page.tsx` (mount `<HistorySearch/>` below recent)
- Modify: `src/components/meal/meal-detail.tsx` (add favorite toggle button using `recent`/current meal ref)

**Interfaces:** Consumes `GET /api/meals` (Task 7 calorie range) + favorites POST/DELETE.

- [ ] **Step 1:** `history-search.tsx`: search input + optional calorie-range + meal-type filter; calls `GET /api/meals?search=&mealType=&minCalories=&maxCalories=&page=` and appends results (infinite scroll via `IntersectionObserver`, or a "Φόρτωσε περισσότερα" button using `addMeal.loadMore`). Each result row has an "Προσθήκη" (opens preview with `{kind:'recent', mealId}`) and a favorite toggle.
- [ ] **Step 2:** In `meal-detail.tsx`, add a favorite toggle button (POST `/api/meals/favorites` with `{kind:'recent', mealId}` / DELETE) with optimistic UI + toast.
- [ ] **Step 3: Checkpoint** — search filters work (title/item/type/date/calorie range); pagination loads more; favoriting from detail then visiting the hub shows it under Αγαπημένα first.

---

## Phase 6 — Verification

### Task 15: Full verification & fixes

- [ ] **Step 1:** From a local copy (UNC constraint): `npm run typecheck` (or `npx tsc --noEmit`) → 0 errors.
- [ ] **Step 2:** `npm run lint` → 0 errors.
- [ ] **Step 3:** `npm test` → all suites green, including the new: `meal-fingerprint`, `meal-scaling`, `meal-ranking`, `meal-fingerprint-wiring`, `meal-history`, `validation`. Confirm the **no-AI** and **IDOR** and **idempotency** and **independent-copy** assertions pass.
- [ ] **Step 4:** `npm run build` (`next build`) → success.
- [ ] **Step 5:** Fix every error/warning surfaced. No TODOs, placeholders, or mock functionality remain.
- [ ] **Step 6:** Deploy to NAS (rebuild) per `OPERATIONS.md`, run `npm run backfill:fingerprints` once, and smoke-test `/meals/add` on the live site.

---

## Self-Review — spec coverage

- Frequent (fingerprint grouping, backend ranking, context/time-of-day) → Tasks 2,4,6,8. ✅
- Recent (5–10 CONFIRMED, exclude draft/failed/cancelled) → Task 6,8. ✅
- Favorites (per-fingerprint template, snapshot, first in order, image survives deletion) → Tasks 1,6,10,12. ✅
- Quick-pick preview + independent copy + no AI + editable + portion presets → Tasks 6,9,13. ✅
- Portion scaling (all macros, decimal-safe, backend) → Tasks 3,6. ✅
- Search history (+ calorie range, pagination/infinite scroll) → Tasks 7,14. ✅
- API security (auth, ownership, validation, rate limit, IDOR, idempotency, no client userId) → Tasks 6,7,9,10. ✅
- UI (mobile-first, design system, skeleton, empty state, thumbnails, confirmation, toast) → Tasks 11–14. ✅
- Privacy (own meals only, authorized images) → Tasks 6,10. ✅
- Migration without data loss + backfill → Task 1,2. ✅
- Tests (isolation, ranking, ordering, exclusions, scaling, independent copy, no-AI, search, IDOR, idempotency) → Tasks 2–10. ✅
