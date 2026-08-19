'use client';

import { Utensils, Plus } from 'lucide-react';
import { useT } from '@/i18n/client';
import { FavoriteToggle } from './favorite-toggle';
import type { QuickPickCardModel, QuickPickRef } from './quick-pick-types';

function macroLabel(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

export function QuickPickCard({
  model,
  onPick,
}: {
  model: QuickPickCardModel;
  onPick: (ref: QuickPickRef, mealType: QuickPickCardModel['mealType']) => void;
}) {
  const t = useT();
  const title = model.title || t(`mealType.${model.mealType}` as never);

  return (
    <article className="flex w-56 shrink-0 flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {model.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Utensils className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {t(`mealType.${model.mealType}` as never)}
          </p>
        </div>
        <FavoriteToggle
          refInput={model.ref}
          initialFavorite={model.isFavorite}
          initialFavoriteId={model.favoriteId}
        />
      </div>

      <p className="tabular-nums text-sm">
        {model.calories === null ? '—' : `${model.calories} kcal`}
      </p>
      <p className="text-xs text-muted-foreground">
        P {macroLabel(model.macros.proteinGrams)} · C {macroLabel(model.macros.carbohydrateGrams)} · F{' '}
        {macroLabel(model.macros.fatGrams)}
      </p>

      {typeof model.usageCount === 'number' ? (
        <p className="text-xs text-muted-foreground">
          {t('addMeal.usedTimes', { count: model.usageCount })}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => onPick(model.ref, model.mealType)}
        className="mt-auto flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> {t('addMeal.add')}
      </button>
    </article>
  );
}
