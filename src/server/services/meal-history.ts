import 'server-only';
import { Prisma, type MealType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { getStorage, buildMealImageKey } from '../storage';
import {
  MEAL_SELECT,
  toMealView,
  type MealView,
  type MacroView,
  createManualMeal,
  type CreateMealResult,
  COUNTED_MEAL_STATUS,
} from './meal';
import { scaleComposition, type ScalableComposition, type MacroFields } from '@/lib/meal-scaling';
import { frequencyScore, expectedMealTypeForHour } from '@/lib/meal-ranking';
import { normalizeCalories, isAboveSoftLimit } from '@/lib/calories';

export type QuickPickRef =
  | { kind: 'favorite'; id: string }
  | { kind: 'frequent'; fingerprint: string }
  | { kind: 'recent'; mealId: string };

export interface FrequentMealView {
  fingerprint: string;
  usageCount: number;
  lastUsedAt: string;
  isFavorite: boolean;
  meal: MealView;
}
export interface FavoriteMealView {
  id: string;
  fingerprint: string;
  title: string | null;
  mealType: MealType;
  calories: number | null;
  macros: MacroView;
  itemCount: number;
  thumbUrl: string | null;
}

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

interface AggRow {
  fingerprint: string;
  usageCount: number;
  lastUsedAt: Date;
  representativeId: string;
  groupMealType: MealType;
}

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
    .map((r) => ({
      row: r,
      score: frequencyScore(
        { usageCount: r.usageCount, lastUsedAt: r.lastUsedAt, groupMealType: r.groupMealType },
        opts.now,
        expected,
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? FREQUENT_LIMIT);

  const ids = ranked.map((r) => r.row.representativeId);
  const [meals, favs] = await Promise.all([
    prisma.meal.findMany({ where: { id: { in: ids }, userId }, select: MEAL_SELECT }),
    prisma.favoriteMeal.findMany({
      where: { userId, fingerprint: { in: rows.map((r) => r.fingerprint) } },
      select: { fingerprint: true },
    }),
  ]);
  const mealById = new Map(meals.map((m) => [m.id, toMealView(m)]));
  const favSet = new Set(favs.map((f) => f.fingerprint));

  return ranked
    .map(({ row }) => {
      const meal = mealById.get(row.representativeId);
      if (!meal) return null;
      return {
        fingerprint: row.fingerprint,
        usageCount: row.usageCount,
        lastUsedAt: row.lastUsedAt.toISOString(),
        isFavorite: favSet.has(row.fingerprint),
        meal,
      };
    })
    .filter((v): v is FrequentMealView => v !== null);
}

function favToView(fav: {
  id: string;
  fingerprint: string;
  title: string | null;
  mealType: MealType;
  calories: number | null;
  items: Prisma.JsonValue;
  thumbKey: string | null;
  proteinGrams: Prisma.Decimal | null;
  carbohydrateGrams: Prisma.Decimal | null;
  fatGrams: Prisma.Decimal | null;
  fiberGrams: Prisma.Decimal | null;
  sugarGrams: Prisma.Decimal | null;
  saturatedFatGrams: Prisma.Decimal | null;
  sodiumMg: number | null;
}): FavoriteMealView {
  const d = (v: Prisma.Decimal | null) => (v === null ? null : v.toNumber());
  return {
    id: fav.id,
    fingerprint: fav.fingerprint,
    title: fav.title,
    mealType: fav.mealType,
    calories: fav.calories,
    macros: {
      proteinGrams: d(fav.proteinGrams),
      carbohydrateGrams: d(fav.carbohydrateGrams),
      fatGrams: d(fav.fatGrams),
      fiberGrams: d(fav.fiberGrams),
      sugarGrams: d(fav.sugarGrams),
      saturatedFatGrams: d(fav.saturatedFatGrams),
      sodiumMg: fav.sodiumMg,
    },
    itemCount: Array.isArray(fav.items) ? fav.items.length : 0,
    thumbUrl: fav.thumbKey ? `/api/meals/favorites/${fav.id}/image` : null,
  };
}

export async function getFavorites(userId: string): Promise<FavoriteMealView[]> {
  const favs = await prisma.favoriteMeal.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  return favs.map(favToView);
}

interface ResolvedBase extends ScalableComposition {
  title: string | null;
  mealType: MealType;
  thumbSourceMealId: string | null;
}

function mealViewToComposition(m: MealView): ScalableComposition {
  return {
    finalCalories: m.finalCalories,
    macros: m.macros,
    items: m.items.map((i) => ({
      name: i.name,
      estimatedQuantity: i.estimatedQuantity,
      finalCalories: i.finalCalories,
      macros: i.macros,
    })),
  };
}

export async function resolveComposition(userId: string, ref: QuickPickRef): Promise<ResolvedBase> {
  if (ref.kind === 'favorite') {
    const fav = await prisma.favoriteMeal.findFirst({ where: { id: ref.id, userId } });
    if (!fav) throw new ApiError('NOT_FOUND', 'Το αγαπημένο γεύμα δεν βρέθηκε.');
    const items = (Array.isArray(fav.items) ? fav.items : []) as unknown as ScalableComposition['items'];
    const d = (v: Prisma.Decimal | null) => (v === null ? null : v.toNumber());
    return {
      title: fav.title,
      mealType: fav.mealType,
      thumbSourceMealId: null,
      finalCalories: fav.calories,
      macros: {
        proteinGrams: d(fav.proteinGrams),
        carbohydrateGrams: d(fav.carbohydrateGrams),
        fatGrams: d(fav.fatGrams),
        fiberGrams: d(fav.fiberGrams),
        sugarGrams: d(fav.sugarGrams),
        saturatedFatGrams: d(fav.saturatedFatGrams),
        sodiumMg: fav.sodiumMg,
      },
      items,
    };
  }
  const where =
    ref.kind === 'recent'
      ? { id: ref.mealId, userId, status: COUNTED_MEAL_STATUS }
      : { userId, status: COUNTED_MEAL_STATUS, mealFingerprint: ref.fingerprint };
  const meal = await prisma.meal.findFirst({ where, orderBy: { mealDateTime: 'desc' }, select: MEAL_SELECT });
  if (!meal) throw new ApiError('NOT_FOUND', 'Το γεύμα δεν βρέθηκε.');
  const view = toMealView(meal);
  return {
    ...mealViewToComposition(view),
    title: view.title,
    mealType: view.mealType,
    thumbSourceMealId: view.hasImage ? view.id : null,
  };
}

export async function previewQuickPick(userId: string, ref: QuickPickRef, multiplier: number) {
  const base = await resolveComposition(userId, ref);
  const composition = scaleComposition(
    { finalCalories: base.finalCalories, macros: base.macros, items: base.items },
    multiplier,
  );
  return { title: base.title, mealType: base.mealType, multiplier, composition };
}

export async function createQuickPick(
  userId: string,
  params: {
    ref: QuickPickRef;
    servingMultiplier: number;
    overrides?: Partial<MacroFields> & { finalCalories?: number };
    mealType: MealType;
    notes?: string;
    requestKey?: string;
  },
  timezone: string,
): Promise<CreateMealResult> {
  const base = await resolveComposition(userId, params.ref);
  const scaled = scaleComposition(
    { finalCalories: base.finalCalories, macros: base.macros, items: base.items },
    params.servingMultiplier,
  );
  const o = params.overrides ?? {};
  const finalCalories = o.finalCalories ?? scaled.finalCalories ?? undefined;
  const macro = (k: keyof MacroFields) => (o[k] !== undefined ? o[k] : scaled.macros[k]);

  const now = new Date();
  // localDateTimeToUtc expects 'YYYY-MM-DDTHH:mm' in the user's tz; build from `now` in that tz.
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => local.find((p) => p.type === t)!.value;
  const mealDateTime = `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;

  const input = {
    mealType: params.mealType,
    mealDateTime,
    title: base.title ?? undefined,
    notes: params.notes,
    finalCalories,
    items: scaled.items.map((i) => ({
      name: i.name,
      estimatedQuantity: i.estimatedQuantity ?? undefined,
      finalCalories: i.finalCalories ?? 0,
      ...i.macros,
    })),
    proteinGrams: macro('proteinGrams'),
    carbohydrateGrams: macro('carbohydrateGrams'),
    fatGrams: macro('fatGrams'),
    fiberGrams: macro('fiberGrams'),
    sugarGrams: macro('sugarGrams'),
    saturatedFatGrams: macro('saturatedFatGrams'),
    sodiumMg: macro('sodiumMg'),
    acknowledgeHighCalories:
      finalCalories !== undefined ? isAboveSoftLimit(normalizeCalories(finalCalories)) : false,
    requestKey: params.requestKey,
  } as Parameters<typeof createManualMeal>[0]['input'];

  logger.info('quick_pick_create', { userId, kind: params.ref.kind, multiplier: params.servingMultiplier });
  return createManualMeal({ userId, input, timezone, source: 'SAVED_MEAL' });
}

export async function addFavorite(userId: string, ref: QuickPickRef): Promise<FavoriteMealView> {
  const base = await resolveComposition(userId, ref);
  const fingerprint = ref.kind === 'frequent' ? ref.fingerprint : await fingerprintForBase(base);

  const existing = await prisma.favoriteMeal.findUnique({
    where: { userId_fingerprint: { userId, fingerprint } },
  });
  if (existing) return favToView(existing);

  let thumbKey: string | null = null;
  if (base.thumbSourceMealId) thumbKey = await copyThumb(userId, base.thumbSourceMealId);

  const dec = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
  const fav = await prisma.favoriteMeal.create({
    data: {
      userId,
      fingerprint,
      title: base.title,
      mealType: base.mealType,
      calories: base.finalCalories ?? null,
      proteinGrams: dec(base.macros.proteinGrams),
      carbohydrateGrams: dec(base.macros.carbohydrateGrams),
      fatGrams: dec(base.macros.fatGrams),
      fiberGrams: dec(base.macros.fiberGrams),
      sugarGrams: dec(base.macros.sugarGrams),
      saturatedFatGrams: dec(base.macros.saturatedFatGrams),
      sodiumMg: base.macros.sodiumMg ?? null,
      items: base.items as unknown as Prisma.InputJsonValue,
      thumbKey,
    },
  });
  return favToView(fav);
}

async function fingerprintForBase(base: ResolvedBase): Promise<string> {
  const { computeMealFingerprint } = await import('@/lib/meal-fingerprint');
  return computeMealFingerprint({
    title: base.title,
    mealType: base.mealType,
    totalCalories: base.finalCalories,
    items: base.items.map((i) => ({ name: i.name, calories: i.finalCalories })),
  });
}

async function copyThumb(userId: string, sourceMealId: string): Promise<string | null> {
  const meal = await prisma.meal.findFirst({
    where: { id: sourceMealId, userId },
    select: { thumbPath: true, imageMimeType: true },
  });
  if (!meal?.thumbPath) return null;
  const storage = getStorage();
  try {
    const body = await storage.get(meal.thumbPath);
    const key = buildMealImageKey(userId, meal.imageMimeType ?? 'image/webp', 'thumb');
    await storage.put(key, body, 'image/webp');
    return key;
  } catch {
    return null;
  }
}

export async function removeFavorite(userId: string, favoriteId: string): Promise<void> {
  const fav = await prisma.favoriteMeal.findFirst({
    where: { id: favoriteId, userId },
    select: { id: true, thumbKey: true },
  });
  if (!fav) throw new ApiError('NOT_FOUND', 'Το αγαπημένο δεν βρέθηκε.');
  await prisma.favoriteMeal.delete({ where: { id: fav.id } });
  if (fav.thumbKey) {
    try {
      await getStorage().delete(fav.thumbKey);
    } catch {
      /* best-effort */
    }
  }
}

export async function getFavoriteThumb(
  userId: string,
  favoriteId: string,
): Promise<{ body: Buffer; contentType: string }> {
  const fav = await prisma.favoriteMeal.findFirst({
    where: { id: favoriteId, userId },
    select: { thumbKey: true },
  });
  if (!fav?.thumbKey) throw new ApiError('NOT_FOUND', 'Δεν υπάρχει εικόνα.');
  return { body: await getStorage().get(fav.thumbKey), contentType: 'image/webp' };
}
