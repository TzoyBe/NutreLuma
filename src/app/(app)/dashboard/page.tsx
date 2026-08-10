import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Pencil, Plus, Utensils } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getDashboard } from '@/server/services/stats';
import { getAccessState } from '@/server/services/subscription';
import { listMilestones } from '@/server/services/milestones';
import { listAchievements } from '@/server/services/achievements';
import { SubscriptionBanner } from '@/components/billing/subscription-banner';
import { dayISOSchema } from '@/lib/validation/meal';
import { formatDateInTz, formatDayISOHuman, formatTimeInTz, todayISO } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclaimer, EmptyState, MacroBar, Progress, StatTile } from '@/components/ui/misc';
import { DateNav } from '@/components/date-nav';
import { MealCard } from '@/components/meal/meal-card';
import { getT } from '@/i18n/locale';
import { localizeAchievement } from '@/lib/achievement-localization';
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

  const [{ summary, macros, meals, drafts }, access, milestones, achievements] = await Promise.all([
    getDashboard(user.id, date),
    getAccessState(user.id),
    listMilestones(user.id, { status: 'ACTIVE', limit: 3 }),
    listAchievements(user.id),
  ]);

  const isToday = date === today;
  const hasMacroTargets =
    macros.protein.target !== null ||
    macros.carbohydrate.target !== null ||
    macros.fat.target !== null;
  const latestAchievement = achievements.find((achievement) => achievement.unlocked);

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
        <div className="grid gap-2 sm:grid-cols-2">
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
        </div>
      ) : (
        <div className="liquid-control flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-muted-foreground">
          <Plus className="h-5 w-5" aria-hidden="true" />
          {t('billing.lockedAction')}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {isToday ? t('dashboard.todayCalories') : t('dashboard.dayCalories')}
            </p>
            <p className="text-4xl font-semibold tabular-nums">
              {summary.consumed}
              <span className="ml-2 text-lg font-normal text-muted-foreground">kcal</span>
            </p>
          </div>

          {summary.target ? (
            <>
              <Progress
                value={summary.consumed}
                max={summary.target}
                over={summary.overTarget}
                label={t('dashboard.target')}
              />
              <div className="grid grid-cols-3 gap-3">
                <StatTile label={t('dashboard.target')} value={summary.target} suffix="kcal" />
                <StatTile
                  label={summary.overTarget ? t('dashboard.over') : t('dashboard.remaining')}
                  value={Math.abs(summary.remaining ?? 0)}
                  suffix="kcal"
                  tone={summary.overTarget ? 'danger' : 'primary'}
                />
                <StatTile label="%" value={summary.progressPercent} suffix="%" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noTarget')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>{t('dashboard.macros')}</CardTitle>
          <Link href="/goals" className="shrink-0 text-sm font-medium text-primary hover:underline">
            {t('dashboard.setGoals')}
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasMacroTargets ? null : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noMacroTargets')}</p>
          )}

          <div className="space-y-3">
            <MacroBar
              label={t('dashboard.protein')}
              consumed={macros.protein.consumed}
              target={macros.protein.target}
              over={macros.protein.overTarget}
            />
            <MacroBar
              label={t('dashboard.carbohydrate')}
              consumed={macros.carbohydrate.consumed}
              target={macros.carbohydrate.target}
              over={macros.carbohydrate.overTarget}
            />
            <MacroBar
              label={t('dashboard.fat')}
              consumed={macros.fat.consumed}
              target={macros.fat.target}
              over={macros.fat.overTarget}
            />
            <MacroBar
              label={t('dashboard.fiber')}
              consumed={macros.fiber.consumed}
              target={macros.fiber.target}
              over={macros.fiber.overTarget}
            />
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>{t('goals.achievementsTitle')}</CardTitle>
          <Link href="/goals/achievements" className="text-sm font-medium text-primary hover:underline">
            {t('common.open')}
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {milestones[0] ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{milestones[0].title}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{milestones[0].percent}%</p>
              </div>
              <Progress value={milestones[0].percent} max={100} label={milestones[0].status} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('achievements.noMilestones')}</p>
          )}
          {latestAchievement ? (
            <p className="text-sm text-muted-foreground">
              {t('achievements.latestAchievement')}:{' '}
              <span className="font-medium text-foreground">
                {
                  localizeAchievement(
                    latestAchievement,
                    t('achievements.achievements') === 'Achievements',
                  ).name
                }
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

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
