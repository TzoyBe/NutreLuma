import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { listMealHistory } from '@/server/services/meal';
import { getHistoryTotals } from '@/server/services/stats';
import { mealHistoryQuerySchema } from '@/lib/validation/meal';
import { formatDateInTz, formatTimeInTz, todayISO } from '@/lib/dates';
import { EmptyState, StatTile } from '@/components/ui/misc';
import { MealCard } from '@/components/meal/meal-card';
import { HistoryFilters } from '@/components/history/history-filters';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('history.title') };
}
export const dynamic = 'force-dynamic';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value !== '') flat[key] = value;
  }

  const parsed = mealHistoryQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : mealHistoryQuerySchema.parse({});

  const [{ meals, total, page, pageSize }, totals] = await Promise.all([
    listMealHistory(user.id, query, profile.timezone),
    getHistoryTotals(
      user.id,
      todayISO(profile.timezone),
      profile.timezone,
      profile.effectiveDailyCalorieTarget,
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildPageUrl = (nextPage: number) => {
    const params = new URLSearchParams(flat);
    params.set('page', String(nextPage));
    return `/history?${params.toString()}`;
  };

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">{t('history.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('history.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('history.dayTotal')} value={totals.dayTotal} suffix="kcal" />
        <StatTile label={t('history.weekTotal')} value={totals.weekTotal} suffix="kcal" />
        <StatTile label={t('history.weekAverage')} value={totals.weekAverage} suffix="kcal" />
        <StatTile label={t('history.monthAverage')} value={totals.monthAverage} suffix="kcal" />
      </div>

      <HistoryFilters
        initial={{
          from: flat.from ?? '',
          to: flat.to ?? '',
          mealType: flat.mealType ?? '',
          search: flat.search ?? '',
        }}
      />

      {meals.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" aria-hidden="true" />}
          title={t('history.empty')}
        />
      ) : (
        <div className="space-y-2">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={{
                id: meal.id,
                title: meal.title ?? t(`mealType.${meal.mealType}` as never),
                mealTypeLabel: t(`mealType.${meal.mealType}` as never),
                timeLabel: formatTimeInTz(new Date(meal.mealDateTime), profile.timezone),
                dateLabel: formatDateInTz(new Date(meal.mealDateTime), profile.timezone),
                calories: meal.finalCalories,
                thumbUrl: meal.thumbUrl,
                analysisStatus: meal.analysisStatus,
                wasManuallyEdited: meal.wasManuallyEdited,
              }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="pagination">
          {page > 1 ? (
            <Link
              href={buildPageUrl(page - 1)}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              ← {t('history.prev')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildPageUrl(page + 1)}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              {t('history.next')} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
