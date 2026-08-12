import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Pencil, Plus, Scale, Utensils } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getDashboard } from '@/server/services/stats';
import { getAccessState } from '@/server/services/subscription';
import { SubscriptionBanner } from '@/components/billing/subscription-banner';
import { dayISOSchema } from '@/lib/validation/meal';
import { formatDateInTz, formatDayISOHuman, formatTimeInTz, todayISO } from '@/lib/dates';
import { Card, CardContent } from '@/components/ui/card';
import { Disclaimer, EmptyState } from '@/components/ui/misc';
import { DateNav } from '@/components/date-nav';
import { MealCard } from '@/components/meal/meal-card';
import { CalorieGauge } from '@/components/dashboard/calorie-gauge';
import { MacroGauge } from '@/components/dashboard/macro-gauge';
import { getT } from '@/i18n/locale';
import { MaintenanceDashboardCard } from '@/components/maintenance/maintenance-dashboard-card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('dashboard.title') };
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const params = await searchParams;
  const today = todayISO(profile.timezone);
  const parsedDate = dayISOSchema.safeParse(params.date);
  const date = parsedDate.success && parsedDate.data <= today ? parsedDate.data : today;

  const [{ summary, macros, meals, drafts }, access] = await Promise.all([
    getDashboard(user.id, date),
    getAccessState(user.id),
  ]);

  const isToday = date === today;
  const mealCard = (meal: (typeof meals)[number] | (typeof drafts)[number]) => (
    <MealCard
      key={meal.id}
      meal={{
        id: meal.id,
        title: meal.title ?? t(`mealType.${meal.mealType}` as never),
        mealTypeLabel: t(`mealType.${meal.mealType}` as never),
        timeLabel: formatTimeInTz(new Date(meal.mealDateTime), profile.timezone),
        calories: meal.finalCalories,
        thumbUrl: meal.thumbUrl,
        analysisStatus: meal.analysisStatus,
        wasManuallyEdited: meal.wasManuallyEdited,
      }}
    />
  );

  return (
    <>
      <SubscriptionBanner
        kind={access.kind}
        daysRemaining={access.daysRemaining}
        accessUntilLabel={
          access.accessUntil ? formatDateInTz(access.accessUntil, profile.timezone) : null
        }
      />

      <div className="space-y-3">
        <h1 className="sr-only">{t('dashboard.title')}</h1>
        <DateNav date={date} maxDate={today} label={formatDayISOHuman(date)} />
      </div>

      {access.canWrite ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            href="/meals/add"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.42)_inset,0_12px_26px_-14px_hsl(var(--primary)/0.95)] transition-colors hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            {t('dashboard.addMeal')}
          </Link>
          <Link
            href="/meals/manual"
            className="liquid-control flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors hover:bg-[hsl(var(--glass-bg)/0.72)]"
          >
            <Pencil className="h-5 w-5" aria-hidden="true" />
            {t('dashboard.addManual')}
          </Link>
          <Link
            href="/weight"
            className="liquid-control flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors hover:bg-[hsl(var(--glass-bg)/0.72)]"
          >
            <Scale className="h-5 w-5" aria-hidden="true" />
            {t('weight.addEntry')}
          </Link>
        </div>
      ) : (
        <div className="liquid-control flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-muted-foreground">
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('billing.lockedAction')}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {isToday ? t('dashboard.todayProgress') : t('dashboard.dayProgress')}
          </h2>
          <Link href="/goals" className="shrink-0 text-sm font-medium text-primary hover:underline">
            {t('dashboard.setGoals')}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="col-span-2 sm:row-span-2">
            <CardContent className="flex h-full items-center justify-center py-6">
              <CalorieGauge
                consumed={summary.consumed}
                target={summary.target}
                remaining={summary.remaining}
                overTarget={summary.overTarget}
                progressPercent={summary.progressPercent}
                labels={{
                  title: isToday ? t('dashboard.todayProgress') : t('dashboard.dayProgress'),
                  of: t('dashboard.ofTarget', { target: summary.target ?? 0 }),
                  remaining: t('dashboard.remainingKcal', { n: Math.abs(summary.remaining ?? 0) }),
                  over: t('dashboard.overKcal', { n: Math.abs(summary.remaining ?? 0) }),
                  noTarget: t('dashboard.noTarget'),
                  kcal: 'kcal',
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full items-center justify-center">
              <MacroGauge
                label={t('dashboard.protein')}
                consumed={macros.protein.consumed}
                target={macros.protein.target}
                over={macros.protein.overTarget}
                color="hsl(168 76% 55%)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full items-center justify-center">
              <MacroGauge
                label={t('dashboard.carbohydrate')}
                consumed={macros.carbohydrate.consumed}
                target={macros.carbohydrate.target}
                over={macros.carbohydrate.overTarget}
                color="hsl(32 92% 60%)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full items-center justify-center">
              <MacroGauge
                label={t('dashboard.fat')}
                consumed={macros.fat.consumed}
                target={macros.fat.target}
                over={macros.fat.overTarget}
                color="hsl(291 64% 68%)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full items-center justify-center">
              <MacroGauge
                label={t('dashboard.fiber')}
                consumed={macros.fiber.consumed}
                target={macros.fiber.target}
                over={macros.fiber.overTarget}
                color="hsl(142 62% 52%)"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('dashboard.meals')}
        </h2>

        {meals.length === 0 ? (
          <EmptyState
            icon={<Utensils className="h-7 w-7" aria-hidden="true" />}
            title={t('dashboard.emptyTitle')}
            body={t('dashboard.emptyBody')}
          />
        ) : (
          <div className="space-y-2">{meals.map((meal) => mealCard(meal))}</div>
        )}
      </section>

      <MaintenanceDashboardCard userId={user.id} />

      {drafts.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('dashboard.draftsTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.draftsBody')}</p>
          </div>
          <div className="space-y-2">{drafts.map((meal) => mealCard(meal))}</div>
        </section>
      ) : null}

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
