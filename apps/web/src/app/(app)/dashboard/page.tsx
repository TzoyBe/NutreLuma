import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Scale, Utensils } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getDashboard } from '@/server/services/stats';
import { waterMlByDay } from '@/server/services/water';
import { stepsByDay } from '@/server/services/activity';
import { getAccessState } from '@/server/services/subscription';
import { ActivityGauges } from '@/components/dashboard/activity-gauges';
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

  const [{ summary, macros, meals, drafts, goal }, access, waterByDay, stepsMap] = await Promise.all([
    getDashboard(user.id, date),
    getAccessState(user.id),
    waterMlByDay(user.id, date, date),
    stepsByDay(user.id, date, date),
  ]);

  const isToday = date === today;
  const waterMl = waterByDay.get(date) ?? 0;
  const steps = stepsMap.get(date) ?? 0;
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
        <div className="glass-subtle grid grid-cols-2 gap-1 rounded-[1.5rem] p-1">
          <Link
            href="/meals/add"
            className="flex h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] bg-primary px-1.5 text-center text-[11px] font-semibold leading-[1.05] text-primary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.42)_inset,0_12px_26px_-16px_hsl(var(--primary)/0.95)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-primary/90 active:scale-[0.98] sm:h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Plus className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="max-w-full text-balance">{t('dashboard.addMeal')}</span>
          </Link>
          <Link
            href="/weight"
            className="flex h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--glass-border)/0.12),hsl(var(--glass-bg)/0.28))] px-1.5 text-center text-[11px] font-semibold leading-[1.05] text-secondary-foreground shadow-[0_1px_0_hsl(var(--glass-border)/0.2)_inset] transition-[background-color,box-shadow,transform] duration-200 hover:bg-[hsl(var(--glass-border)/0.14)] active:scale-[0.98] sm:h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Scale className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" aria-hidden="true" />
            <span className="max-w-full text-balance">{t('weight.addEntry')}</span>
          </Link>
        </div>
      ) : (
        <div className="liquid-control flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-muted-foreground sm:h-14 sm:rounded-full sm:text-base">
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
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
                color="#38BDF8"
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
                color="#FFB703"
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
                color="#A855F7"
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
                color="#10B981"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <ActivityGauges
        date={date}
        isToday={isToday}
        waterMl={waterMl}
        steps={steps}
        goal={{
          calorieTarget: goal.calorieTarget,
          proteinGrams: goal.proteinGrams,
          carbohydrateGrams: goal.carbohydrateGrams,
          fatGrams: goal.fatGrams,
          fiberGrams: goal.fiberGrams,
          waterMl: goal.waterMl,
          stepsTarget: goal.stepsTarget,
        }}
      />

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
