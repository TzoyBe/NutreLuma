'use client';

import * as React from 'react';
import type { MealType } from '@prisma/client';
import { useT } from '@/i18n/client';
import { QuickPickCard } from './quick-pick-card';
import { QuickPickPreview } from './quick-pick-preview';
import type { QuickMacros, QuickPickCardModel, QuickPickRef } from './quick-pick-types';

/** Client-safe εκδοχές των server views (μόνο τα πεδία που χρειάζεται το UI). */
interface MealLike {
  id: string;
  title: string | null;
  mealType: MealType;
  finalCalories: number | null;
  macros: QuickMacros;
  thumbUrl: string | null;
}
interface FavoriteLike {
  id: string;
  fingerprint: string;
  title: string | null;
  mealType: MealType;
  calories: number | null;
  macros: QuickMacros;
  thumbUrl: string | null;
}
interface FrequentLike {
  fingerprint: string;
  usageCount: number;
  lastUsedAt: string;
  isFavorite: boolean;
  meal: MealLike;
}

function favToModel(f: FavoriteLike): QuickPickCardModel {
  return {
    ref: { kind: 'favorite', id: f.id },
    title: f.title ?? '',
    mealType: f.mealType,
    calories: f.calories,
    macros: f.macros,
    thumbUrl: f.thumbUrl,
    isFavorite: true,
    favoriteId: f.id,
  };
}
function freqToModel(f: FrequentLike): QuickPickCardModel {
  return {
    ref: { kind: 'frequent', fingerprint: f.fingerprint },
    title: f.meal.title ?? '',
    mealType: f.meal.mealType,
    calories: f.meal.finalCalories,
    macros: f.meal.macros,
    thumbUrl: f.meal.thumbUrl,
    isFavorite: f.isFavorite,
    favoriteId: null,
    usageCount: f.usageCount,
    lastUsedAt: f.lastUsedAt,
  };
}
function recentToModel(m: MealLike): QuickPickCardModel {
  return {
    ref: { kind: 'recent', mealId: m.id },
    title: m.title ?? '',
    mealType: m.mealType,
    calories: m.finalCalories,
    macros: m.macros,
    thumbUrl: m.thumbUrl,
    isFavorite: false,
    favoriteId: null,
  };
}

function Section({
  title,
  models,
  emptyLabel,
  onPick,
}: {
  title: string;
  models: QuickPickCardModel[];
  emptyLabel: string;
  onPick: (ref: QuickPickRef, mealType: MealType) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {models.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="meal-scroll-row -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {models.map((m) => (
            <QuickPickCard key={`${m.ref.kind}-${JSON.stringify(m.ref)}`} model={m} onPick={onPick} />
          ))}
        </div>
      )}
    </section>
  );
}

export function QuickPickSection({
  favorites,
  frequent,
  recent,
  mode = 'all',
}: {
  favorites: FavoriteLike[];
  frequent: FrequentLike[];
  recent: MealLike[];
  mode?: 'all' | 'favorites' | 'history';
}) {
  const t = useT();
  const [pick, setPick] = React.useState<{ ref: QuickPickRef; mealType: MealType } | null>(null);

  const onPick = React.useCallback(
    (ref: QuickPickRef, mealType: MealType) => setPick({ ref, mealType }),
    [],
  );

  return (
    <div className="space-y-6">
      {mode !== 'history' ? <Section title={t('addMeal.favorites')} models={favorites.map(favToModel)} emptyLabel={t('addMeal.favoritesEmpty')} onPick={onPick} /> : null}
      {mode !== 'favorites' ? <Section title={t('addMeal.frequent')} models={frequent.map(freqToModel)} emptyLabel={t('addMeal.frequentEmpty')} onPick={onPick} /> : null}
      {mode !== 'favorites' ? <Section title={t('addMeal.recent')} models={recent.map(recentToModel)} emptyLabel={t('addMeal.recentEmpty')} onPick={onPick} /> : null}

      {pick ? (
        <QuickPickPreview
          pickRef={pick.ref}
          defaultMealType={pick.mealType}
          onClose={() => setPick(null)}
        />
      ) : null}
    </div>
  );
}
