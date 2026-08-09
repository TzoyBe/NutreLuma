'use client';

import * as React from 'react';
import type { MealType } from '@prisma/client';
import { Plus, Search, Utensils } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { MEAL_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { FavoriteToggle } from './favorite-toggle';
import { QuickPickPreview } from './quick-pick-preview';
import type { QuickPickRef } from './quick-pick-types';

interface HistoryRow {
  id: string;
  title: string | null;
  mealType: MealType;
  finalCalories: number | null;
  thumbUrl: string | null;
}
interface HistoryResponse {
  meals: HistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

export function HistorySearch() {
  const t = useT();
  const toast = useToast();

  const [term, setTerm] = React.useState('');
  const [mealType, setMealType] = React.useState<'' | MealType>('');
  const [minCal, setMinCal] = React.useState('');
  const [maxCal, setMaxCal] = React.useState('');

  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [pick, setPick] = React.useState<{ ref: QuickPickRef; mealType: MealType } | null>(null);

  const load = React.useCallback(
    async (nextPage: number, reset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (term.trim()) params.set('search', term.trim());
        if (mealType) params.set('mealType', mealType);
        if (minCal.trim()) params.set('minCalories', minCal.trim());
        if (maxCal.trim()) params.set('maxCalories', maxCal.trim());
        params.set('page', String(nextPage));
        params.set('pageSize', String(PAGE_SIZE));

        const data = await api.get<HistoryResponse>(`/api/meals?${params.toString()}`);
        setTotal(data.total);
        setPage(data.page);
        setRows((prev) => (reset ? data.meals : [...prev, ...data.meals]));
      } catch (error) {
        toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      } finally {
        setLoading(false);
      }
    },
    [term, mealType, minCal, maxCal, toast, t],
  );

  const hasMore = rows.length < total;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void load(1, true);
  }

  return (
    <section className="space-y-3">
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('addMeal.searchPlaceholder')}
            aria-label={t('addMeal.searchPlaceholder')}
          />
          <Button type="submit" variant="primary" size="icon" aria-label={t('addMeal.searchPlaceholder')}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as '' | MealType)}
            aria-label={t('meal.type')}
          >
            <option value="">{t('meal.type')}</option>
            {MEAL_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {t(`mealType.${mt}` as never)}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            inputMode="numeric"
            value={minCal}
            onChange={(e) => setMinCal(e.target.value)}
            placeholder="min kcal"
            aria-label="min kcal"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={maxCal}
            onChange={(e) => setMaxCal(e.target.value)}
            placeholder="max kcal"
            aria-label="max kcal"
          />
        </div>
      </form>

      <ul className="space-y-2">
        {rows.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
              {m.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <Utensils className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.title || t(`mealType.${m.mealType}` as never)}
              </p>
              <p className="tabular-nums text-xs text-muted-foreground">
                {m.finalCalories === null ? '—' : `${m.finalCalories} kcal`} ·{' '}
                {t(`mealType.${m.mealType}` as never)}
              </p>
            </div>
            <FavoriteToggle refInput={{ kind: 'recent', mealId: m.id }} initialFavorite={false} />
            <Button
              variant="outline"
              size="icon"
              aria-label={t('addMeal.add')}
              onClick={() => setPick({ ref: { kind: 'recent', mealId: m.id }, mealType: m.mealType })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void load(page + 1, false)} loading={loading}>
            {t('addMeal.loadMore')}
          </Button>
        </div>
      ) : null}

      {pick ? (
        <QuickPickPreview
          pickRef={pick.ref}
          defaultMealType={pick.mealType}
          onClose={() => setPick(null)}
        />
      ) : null}
    </section>
  );
}
