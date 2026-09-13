import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Utensils } from 'lucide-react';

import { SubscriptionBanner } from '@/components/billing/subscription-banner';
import { StepsRing, WaterRing } from '@/components/dashboard/activity-gauges';
import { OrbitalDashboard } from '@/components/dashboard/orbital-dashboard';
import { buildOrbitalDashboardModel } from '@/components/dashboard/orbital-dashboard-model';
import { DateNav } from '@/components/date-nav';
import { MaintenanceDashboardCard } from '@/components/maintenance/maintenance-dashboard-card';
import { MealCard } from '@/components/meal/meal-card';
import { MealReelCard } from '@/components/meal/meal-reel-card';
import { Disclaimer, EmptyState } from '@/components/ui/misc';
import { formatDateInTz, formatDayISOHuman, formatTimeInTz, todayISO } from '@/lib/dates';
import { dayISOSchema } from '@/lib/validation/meal';
import { requirePageUser } from '@/server/auth/guards';
import { stepsByDay } from '@/server/services/activity';
import { getProfile } from '@/server/services/profile';
import { getDashboard } from '@/server/services/stats';
import { getAccessState } from '@/server/services/subscription';
import { waterMlByDay } from '@/server/services/water';
import { getT } from '@/i18n/locale';

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
  const orbitalModel = buildOrbitalDashboardModel({
    calories: { current: summary.consumed, target: summary.target },
    protein: { current: macros.protein.consumed, target: macros.protein.target },
    carbohydrate: { current: macros.carbohydrate.consumed, target: macros.carbohydrate.target },
    fat: { current: macros.fat.consumed, target: macros.fat.target },
    fiber: { current: macros.fiber.consumed, target: macros.fiber.target },
    water: { current: waterMl, target: goal.waterMl },
    steps: { current: steps, target: goal.stepsTarget ?? 10000 },
  });

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
        accessUntilLabel={access.accessUntil ? formatDateInTz(access.accessUntil, profile.timezone) : null}
      />

      <OrbitalDashboard
        model={orbitalModel}
        dateLabel={isToday ? 'Today' : formatDayISOHuman(date)}
        dateControl={<DateNav date={date} maxDate={today} label={formatDayISOHuman(date)} />}
        canWrite={access.canWrite}
        waterControl={<WaterRing date={date} isToday={isToday && access.canWrite} waterMl={waterMl} goal={{ waterMl: goal.waterMl }} size="clamp(128px, 17vw, 190px)" />}
        stepsControl={<StepsRing date={date} isToday={isToday && access.canWrite} steps={steps} goal={{ stepsTarget: goal.stepsTarget }} size="clamp(128px, 17vw, 190px)" />}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.meals')}</h2>
        {meals.length === 0 ? (
          <EmptyState icon={<Utensils className="h-7 w-7" aria-hidden="true" />} title={t('dashboard.emptyTitle')} body={t('dashboard.emptyBody')} />
        ) : (
          <div className="meal-reel meal-scroll-row">
            {meals.map((meal) => (
              <MealReelCard
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
            ))}
          </div>
        )}
      </section>

      <MaintenanceDashboardCard userId={user.id} />

      {drafts.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.draftsTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('dashboard.draftsBody')}</p>
          </div>
          <div className="space-y-2">{drafts.map((meal) => mealCard(meal))}</div>
        </section>
      ) : null}

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
