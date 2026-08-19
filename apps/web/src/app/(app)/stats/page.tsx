import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getStatsOverview } from '@/server/services/stats';
import { formatDayISOHuman } from '@/lib/dates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclaimer, EmptyState, StatTile } from '@/components/ui/misc';
import { BarChart, DistributionBar, LineChart } from '@/components/charts';
import { ConsistencyHeatmap } from '@/components/stats/consistency-heatmap';
import { cn } from '@/lib/utils';
import { getLocale, getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('stats.title') };
}
export const dynamic = 'force-dynamic';

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const params = await searchParams;
  const days = params.days === '90' ? 90 : 30;
  const stats = await getStatsOverview(user.id, days);

  const chartData = stats.dailyTotals.map((point) => ({
    label: formatDayISOHuman(point.day),
    value: point.total,
    highlight: stats.target ? point.total > stats.target : false,
  }));

  const locale = await getLocale();
  const intlLocale = locale === 'el' ? 'el-GR' : 'en-GB';
  const weekdayName = (wd: number) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(new Date(Date.UTC(2023, 0, 1 + wd)));
  const weekdayAvgMap = new Map(stats.weekdayAverages.map((w) => [w.weekday, w.average]));
  const maxWeekdayAvg = Math.max(0, ...stats.weekdayAverages.map((w) => w.average));
  const weekdayData = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const value = weekdayAvgMap.get(wd) ?? 0;
    return { label: weekdayName(wd), value, highlight: value === maxWeekdayAvg && maxWeekdayAvg > 0 };
  });

  const timeLabels: Record<string, string> = {
    morning: t('stats.timeMorning'),
    midday: t('stats.timeMidday'),
    afternoon: t('stats.timeAfternoon'),
    evening: t('stats.timeEvening'),
    night: t('stats.timeNight'),
  };
  const timeSlices = stats.timeOfDay.map((b) => ({
    label: timeLabels[b.bucket],
    percent: b.percent,
    total: b.total,
  }));
  const nightPercent = stats.timeOfDay.find((b) => b.bucket === 'night')?.percent ?? 0;

  const weightData = stats.weight
    ? stats.weight.points.map((p) => ({ label: formatDayISOHuman(p.day), value: p.value }))
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('stats.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('stats.subtitle')}</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {[30, 90].map((value) => (
            <Link
              key={value}
              href={`/stats?days=${value}`}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                days === value ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground',
              )}
            >
              {value === 30 ? t('stats.range30') : t('stats.range90')}
            </Link>
          ))}
        </div>
      </div>

      {stats.daysLogged === 0 ? (
        <EmptyState title={t('stats.noData')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t('stats.avg7')} value={stats.average7} suffix="kcal" />
            <StatTile label={t('stats.avg30')} value={stats.average30} suffix="kcal" />
            <StatTile label={t('history.weekTotal')} value={stats.weekTotal} suffix="kcal" />
            <StatTile
              label={t('stats.daysWithinTarget')}
              value={stats.daysWithinTargetPercent ?? '—'}
              suffix={stats.daysWithinTargetPercent === null ? undefined : '%'}
              tone="primary"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.consistency')}</CardTitle>
              <CardDescription>{t('stats.consistencySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ConsistencyHeatmap
                days={stats.dailyTotals}
                target={stats.target}
                legend={{
                  onTarget: t('stats.legendOnTarget'),
                  over: t('stats.legendOver'),
                  noLog: t('stats.legendNoLog'),
                  logged: t('stats.legendLogged'),
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.caloriesPerDay')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <BarChart
                data={chartData}
                targetLine={stats.target}
                ariaLabel={t('stats.caloriesPerDay')}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDayISOHuman(stats.from)}</span>
                {stats.target ? (
                  <span>
                    {t('stats.vsTarget')}: {stats.target} kcal
                  </span>
                ) : null}
                <span>{formatDayISOHuman(stats.to)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.weightVsCalories')}</CardTitle>
              <CardDescription>{t('stats.weightVsCaloriesSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.weight ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatTile
                      label={t('stats.weightChange')}
                      value={`${stats.weight.deltaKg > 0 ? '+' : ''}${stats.weight.deltaKg}`}
                      suffix="kg"
                      tone={stats.weight.deltaKg <= 0 ? 'primary' : 'default'}
                    />
                    <StatTile label={t('stats.avgIntake')} value={stats.avgIntake} suffix="kcal" />
                  </div>
                  <LineChart data={weightData} ariaLabel={t('stats.weightVsCalories')} unit="kg" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDayISOHuman(stats.weight.points[0].day)}</span>
                    <span>
                      {formatDayISOHuman(stats.weight.points[stats.weight.points.length - 1].day)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('stats.weightNeedMore')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.weekdayPattern')}</CardTitle>
              <CardDescription>{t('stats.weekdaySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={weekdayData}
                targetLine={stats.target}
                ariaLabel={t('stats.weekdayPattern')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.eatingTimes')}</CardTitle>
              <CardDescription>{t('stats.eatingTimesSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DistributionBar ariaLabel={t('stats.eatingTimes')} slices={timeSlices} />
              {nightPercent >= 20 ? (
                <p className="text-sm text-muted-foreground">
                  {t('stats.lateNightHint', { percent: nightPercent })}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.distribution')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DistributionBar
                ariaLabel={t('stats.distribution')}
                slices={stats.distribution.map((slice) => ({
                  label: t(`mealType.${slice.mealType}` as never),
                  percent: slice.percent,
                  total: slice.total,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
