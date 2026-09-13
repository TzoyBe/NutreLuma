import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Utensils } from 'lucide-react';

import { AuroraDashboard } from '@/components/dashboard/aurora-dashboard';
import { WaterRing, StepsRing } from '@/components/dashboard/activity-gauges';
import { SubscriptionBanner } from '@/components/billing/subscription-banner';
import { MaintenanceDashboardCard } from '@/components/maintenance/maintenance-dashboard-card';
import { DateNav } from '@/components/date-nav';
import { MealCard } from '@/components/meal/meal-card';
import { MealReelCard } from '@/components/meal/meal-reel-card';
import { Disclaimer, EmptyState } from '@/components/ui/misc';
import { formatDateInTz, formatDayISOHuman, formatTimeInTz, todayISO } from '@/lib/dates';
import { dayISOSchema } from '@/lib/validation/meal';
import { getT } from '@/i18n/locale';
import { requirePageUser } from '@/server/auth/guards';
import { stepsByDay } from '@/server/services/activity';
import { getProfile } from '@/server/services/profile';
import { getDashboard } from '@/server/services/stats';
import { getAccessState } from '@/server/services/subscription';
import { waterMlByDay } from '@/server/services/water';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('dashboard.title') };
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const params = await searchParams;
  const today = todayISO(profile.timezone);
  const parsedDate = dayISOSchema.safeParse(params.date);
  const date = parsedDate.success && parsedDate.data <= today ? parsedDate.data : today;
  const [dashboard, access, waterByDay, stepsMap] = await Promise.all([
    getDashboard(user.id, date),
    getAccessState(user.id),
    waterMlByDay(user.id, date, date),
    stepsByDay(user.id, date, date),
  ]);

  const { meals, drafts, goal } = dashboard;
  const isToday = date === today;
  const waterMl = waterByDay.get(date) ?? 0;
  const steps = stepsMap.get(date) ?? 0;
  const mealCard = (meal: (typeof meals)[number] | (typeof drafts)[number]) => (
    <MealCard key={meal.id} meal={{ id: meal.id, title: meal.title ?? t(`mealType.${meal.mealType}` as never), mealTypeLabel: t(`mealType.${meal.mealType}` as never), timeLabel: formatTimeInTz(new Date(meal.mealDateTime), profile.timezone), calories: meal.finalCalories, thumbUrl: meal.thumbUrl, analysisStatus: meal.analysisStatus, wasManuallyEdited: meal.wasManuallyEdited }} />
  );

  const mealContent = meals.length === 0 ? (
    <EmptyState icon={<Utensils className="h-7 w-7" aria-hidden="true" />} title={t('dashboard.emptyTitle')} body={t('dashboard.emptyBody')} />
  ) : (
    <div className="meal-reel meal-scroll-row">
      {meals.map((meal) => <MealReelCard key={meal.id} meal={{ id: meal.id, title: meal.title ?? t(`mealType.${meal.mealType}` as never), mealTypeLabel: t(`mealType.${meal.mealType}` as never), timeLabel: formatTimeInTz(new Date(meal.mealDateTime), profile.timezone), calories: meal.finalCalories, thumbUrl: meal.thumbUrl, analysisStatus: meal.analysisStatus, wasManuallyEdited: meal.wasManuallyEdited }} />)}
    </div>
  );

  return (
    <>
      <SubscriptionBanner kind={access.kind} daysRemaining={access.daysRemaining} accessUntilLabel={access.accessUntil ? formatDateInTz(access.accessUntil, profile.timezone) : null} />
      <AuroraDashboard
        dashboard={dashboard}
        displayName={user.displayName}
        canWrite={access.canWrite}
        waterMl={waterMl}
        steps={steps}
        dateControl={<DateNav date={date} maxDate={today} label={formatDayISOHuman(date)} />}
        activityControls={<><WaterRing date={date} isToday={isToday} waterMl={waterMl} goal={{ waterMl: goal.waterMl }} /><StepsRing date={date} isToday={isToday} steps={steps} goal={{ stepsTarget: goal.stepsTarget }} /></>}
        meals={mealContent}
      />
      <MaintenanceDashboardCard userId={user.id} />
      {drafts.length > 0 ? (
        <section className="space-y-3">
          <div><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('dashboard.draftsTitle')}</h2><p className="text-xs text-muted-foreground">{t('dashboard.draftsBody')}</p></div>
          <div className="space-y-2">{drafts.map((meal) => mealCard(meal))}</div>
        </section>
      ) : null}
      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
