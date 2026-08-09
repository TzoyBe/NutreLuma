'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Progress, StatTile, Disclaimer } from '@/components/ui/misc';
import { useToast } from '@/components/toast';
import { useT, type TranslateFn } from '@/i18n/client';
import type {
  EligibilityView,
  MaintenanceDashboard,
  MaintenanceTrends,
  WeeklyReport,
  AlertView,
} from '@/server/services/maintenance';
import type { GoalModeHistoryEntry } from '@/server/services/goal-mode';
import { RangeChart } from './range-chart';

type Mode = 'LOSS' | 'MAINTENANCE' | 'GAIN';

interface Props {
  eligibility: EligibilityView;
  mode: Mode;
  dashboard: MaintenanceDashboard | null;
  trends: MaintenanceTrends | null;
  report: WeeklyReport | null;
  alerts: AlertView[];
  modeHistory: GoalModeHistoryEntry[];
}

function statusLabel(t: TranslateFn, status: string): string {
  switch (status) {
    case 'WITHIN_RANGE':
      return t('maintenance.statusWithin');
    case 'NEAR_UPPER':
      return t('maintenance.statusNearUpper');
    case 'NEAR_LOWER':
      return t('maintenance.statusNearLower');
    case 'ABOVE_RANGE':
      return t('maintenance.statusAbove');
    case 'BELOW_RANGE':
      return t('maintenance.statusBelow');
    default:
      return t('maintenance.statusInsufficient');
  }
}

function trendLabel(t: TranslateFn, trend: string): string {
  return trend === 'up'
    ? t('maintenance.trendUp')
    : trend === 'down'
      ? t('maintenance.trendDown')
      : t('maintenance.trendStable');
}

const fmt = (n: number | null, suffix = '') => (n === null ? '—' : `${n}${suffix}`);

export function MaintenanceClient(props: Props) {
  const t = useT();
  if (props.mode === 'MAINTENANCE' && props.dashboard) {
    return <ActiveDashboard {...props} dashboard={props.dashboard} />;
  }
  if (props.eligibility.eligible && !props.eligibility.alreadyActive) {
    return <UnlockAndOnboard eligibility={props.eligibility} />;
  }
  return <LockedView t={t} eligibility={props.eligibility} />;
}

// ------------------------------------------------------------------
// Locked
// ------------------------------------------------------------------

function LockedView({ t, eligibility }: { t: TranslateFn; eligibility: EligibilityView }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('maintenance.lockedTitle')}</h1>
      <Card>
        <CardContent className="space-y-4 py-6">
          <p className="text-sm text-muted-foreground">{t('maintenance.lockedBody')}</p>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{t('maintenance.unlockProgress')}</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {eligibility.progressPercent}%
              </p>
            </div>
            <Progress value={eligibility.progressPercent} max={100} label={t('maintenance.unlockProgress')} />
          </div>
          {eligibility.current !== null && eligibility.targetWeightKg !== null ? (
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={t('maintenance.current7d')} value={eligibility.current} suffix="kg" />
              <StatTile label={t('maintenance.targetWeight')} value={eligibility.targetWeightKg} suffix="kg" />
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Disclaimer text={t('maintenance.disclaimer')} />
    </div>
  );
}

// ------------------------------------------------------------------
// Unlock celebration + onboarding wizard
// ------------------------------------------------------------------

function UnlockAndOnboard({ eligibility }: { eligibility: EligibilityView }) {
  const t = useT();
  const [showForm, setShowForm] = React.useState(false);

  if (showForm) return <OnboardingWizard eligibility={eligibility} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('maintenance.unlockedTitle')}</h1>
      <Card>
        <CardContent className="space-y-4 py-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-2xl">
            🎯
          </div>
          <p className="text-sm text-muted-foreground">{t('maintenance.unlockedBody')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => setShowForm(true)}>{t('maintenance.activate')}</Button>
          </div>
        </CardContent>
      </Card>
      <Disclaimer text={t('maintenance.disclaimer')} />
    </div>
  );
}

function OnboardingWizard({ eligibility }: { eligibility: EligibilityView }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const target = eligibility.targetWeightKg ?? eligibility.current ?? 0;
  const range = eligibility.suggestedRange ?? { lower: target - 1.5, upper: target + 1.5 };

  const [form, setForm] = React.useState({
    targetWeightKg: String(target),
    lowerBoundaryKg: String(range.lower),
    upperBoundaryKg: String(range.upper),
    weighInsPerWeek: '3',
    calorieTarget: String(eligibility.suggestedCalorieTarget ?? ''),
    applyCalorieTarget: false,
    proteinGrams: '',
    carbohydrateGrams: '',
    fatGrams: '',
    weeklyCalorieMin: '',
    weeklyCalorieMax: '',
    alertSensitivity: 'MEDIUM',
    confirm: false,
  });
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const oldTarget = eligibility.currentCalorieTarget;
  const suggested = eligibility.suggestedCalorieTarget;
  const diff = oldTarget !== null && suggested !== null ? suggested - oldTarget : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
    try {
      await api.post('/api/maintenance/activate', {
        targetWeightKg: Number(form.targetWeightKg),
        lowerBoundaryKg: Number(form.lowerBoundaryKg),
        upperBoundaryKg: Number(form.upperBoundaryKg),
        weighInsPerWeek: Number(form.weighInsPerWeek),
        calorieTarget: Number(form.calorieTarget),
        applyCalorieTarget: form.applyCalorieTarget,
        proteinGrams: num(form.proteinGrams),
        carbohydrateGrams: num(form.carbohydrateGrams),
        fatGrams: num(form.fatGrams),
        weeklyCalorieMin: num(form.weeklyCalorieMin),
        weeklyCalorieMax: num(form.weeklyCalorieMax),
        alertSensitivity: form.alertSensitivity,
        confirm: form.confirm,
      });
      toast.push(t('maintenance.dashboardTitle'), 'success');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors());
        toast.push(err.message, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('maintenance.onboardingTitle')}</h1>
      <Card>
        <CardContent className="space-y-4 py-6">
          <p className="text-sm text-muted-foreground">{t('maintenance.onboardingIntro')}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('maintenance.targetWeight')} htmlFor="mtarget" error={errors.targetWeightKg}>
              <Input id="mtarget" type="number" step="0.1" value={form.targetWeightKg}
                onChange={(e) => set('targetWeightKg', e.target.value)} />
            </Field>
            <Field label={t('maintenance.lowerBoundary')} htmlFor="mlow" error={errors.lowerBoundaryKg}>
              <Input id="mlow" type="number" step="0.1" value={form.lowerBoundaryKg}
                onChange={(e) => set('lowerBoundaryKg', e.target.value)} />
            </Field>
            <Field label={t('maintenance.upperBoundary')} htmlFor="mup" error={errors.upperBoundaryKg}>
              <Input id="mup" type="number" step="0.1" value={form.upperBoundaryKg}
                onChange={(e) => set('upperBoundaryKg', e.target.value)} />
            </Field>
          </div>

          <Field label={t('maintenance.weighInFrequency')} htmlFor="mfreq">
            <Input id="mfreq" type="number" min="1" max="14" value={form.weighInsPerWeek}
              onChange={(e) => set('weighInsPerWeek', e.target.value)} />
          </Field>

          <div className="rounded-lg border border-border p-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-muted-foreground">{t('maintenance.oldTarget')}</p>
                <p className="font-semibold tabular-nums">{oldTarget ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('maintenance.suggestedTarget')}</p>
                <p className="font-semibold tabular-nums">{suggested ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('maintenance.difference')}</p>
                <p className="font-semibold tabular-nums">{diff === null ? '—' : (diff > 0 ? `+${diff}` : diff)}</p>
              </div>
            </div>
          </div>

          <Field label={t('maintenance.calorieTarget')} htmlFor="mcal" error={errors.calorieTarget}>
            <Input id="mcal" type="number" value={form.calorieTarget}
              onChange={(e) => set('calorieTarget', e.target.value)} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Protein (g)" htmlFor="mprot"><Input id="mprot" type="number" value={form.proteinGrams} onChange={(e) => set('proteinGrams', e.target.value)} /></Field>
            <Field label="Carbs (g)" htmlFor="mcarb"><Input id="mcarb" type="number" value={form.carbohydrateGrams} onChange={(e) => set('carbohydrateGrams', e.target.value)} /></Field>
            <Field label="Fat (g)" htmlFor="mfat"><Input id="mfat" type="number" value={form.fatGrams} onChange={(e) => set('fatGrams', e.target.value)} /></Field>
          </div>

          <Field label={t('maintenance.alertSensitivity')} htmlFor="msens">
            <Select id="msens" value={form.alertSensitivity} onChange={(e) => set('alertSensitivity', e.target.value)}>
              <option value="LOW">{t('maintenance.sensitivityLow')}</option>
              <option value="MEDIUM">{t('maintenance.sensitivityMedium')}</option>
              <option value="HIGH">{t('maintenance.sensitivityHigh')}</option>
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.applyCalorieTarget}
              onChange={(e) => set('applyCalorieTarget', e.target.checked)} />
            {t('maintenance.applyCalorieTarget')}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.confirm}
              onChange={(e) => set('confirm', e.target.checked)} />
            {t('maintenance.confirmActivation')}
          </label>

          <Button type="submit" loading={saving} disabled={!form.confirm} block>
            {t('maintenance.activate')}
          </Button>
        </CardContent>
      </Card>
      <Disclaimer text={t('maintenance.disclaimer')} />
    </form>
  );
}

// ------------------------------------------------------------------
// Active dashboard
// ------------------------------------------------------------------

function ActiveDashboard(props: Props & { dashboard: MaintenanceDashboard }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { dashboard, trends, report, alerts, modeHistory, mode } = props;

  const dismiss = async (id: string) => {
    try {
      await api.post(`/api/maintenance/alerts/${id}/dismiss`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) toast.push(err.message, 'error');
    }
  };

  const changeMode = async (next: Mode) => {
    if (next === mode) return;
    try {
      await api.put('/api/maintenance/mode', { mode: next, reason: 'user_switch' });
      toast.push(t('maintenance.modeSettings'), 'success');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) toast.push(err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('maintenance.dashboardTitle')}</h1>

      {/* Alerts */}
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                'flex items-start justify-between gap-3 rounded-lg border p-3 text-sm',
                a.severity === 'ATTENTION' ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card',
              )}
            >
              <p>{a.message}</p>
              <button type="button" onClick={() => dismiss(a.id)}
                className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
                {t('maintenance.dismiss')}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Range card */}
      <Card>
        <CardHeader><CardTitle>{t('maintenance.rangeCard')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t('maintenance.current7d')} value={fmt(dashboard.current7dAverage)} suffix="kg" />
            <StatTile label={t('maintenance.rangeCard')} value={`${dashboard.range.lower}–${dashboard.range.upper}`} suffix="kg" />
            <StatTile label={t('maintenance.distanceFromCenter')} value={dashboard.distanceFromCenter} suffix="kg" />
            <StatTile label={t('maintenance.status')} value={statusLabel(t, dashboard.status)} />
          </div>
        </CardContent>
      </Card>

      {/* Range chart */}
      {trends && trends.points.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>{t('maintenance.rangeChart')}</CardTitle></CardHeader>
          <CardContent>
            <RangeChart
              points={trends.average7d}
              range={trends.range}
              rawPoints={trends.points}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Stability trend */}
      <Card>
        <CardHeader><CardTitle>{t('maintenance.stabilityTrend')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label={t('maintenance.avg7')} value={fmt(dashboard.stability.avg7)} suffix="kg" />
          <StatTile label={t('maintenance.avg14')} value={fmt(dashboard.stability.avg14)} suffix="kg" />
          <StatTile label={t('maintenance.avg30')} value={fmt(dashboard.stability.avg30)} suffix="kg" />
          <StatTile label={t('maintenance.variability')} value={dashboard.stability.variability} suffix="kg" />
          <StatTile label={t('maintenance.daysInRange')} value={dashboard.stability.daysWithinRange30} />
        </CardContent>
      </Card>

      {/* Calorie consistency */}
      <Card>
        <CardHeader><CardTitle>{t('maintenance.calorieConsistency')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('maintenance.avgCalories7')} value={fmt(dashboard.calorie.avg7)} suffix="kcal" />
          <StatTile label={t('maintenance.avgCalories30')} value={fmt(dashboard.calorie.avg30)} suffix="kcal" />
          <StatTile label={t('maintenance.diffFromTarget')} value={fmt(dashboard.calorie.diffFromTarget)} suffix="kcal" />
          <StatTile label={t('maintenance.completeDays')} value={dashboard.calorie.completeDays7} />
        </CardContent>
      </Card>

      {/* Habit consistency */}
      <Card>
        <CardHeader><CardTitle>{t('maintenance.habitConsistency')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <HabitBar label={t('maintenance.mealLogging')} value={dashboard.habits.mealLoggingPercent} />
          <HabitBar label={t('maintenance.proteinTarget')} value={dashboard.habits.proteinTargetPercent} />
          <HabitBar label={t('maintenance.waterTracking')} value={dashboard.habits.waterTrackingPercent} />
          <HabitBar label={t('maintenance.activity')} value={dashboard.habits.activityPercent} />
          <HabitBar label={t('maintenance.weighIn')} value={dashboard.habits.weighInPercent} />
        </CardContent>
      </Card>

      {/* Stability score */}
      <Card>
        <CardHeader><CardTitle>{t('maintenance.stabilityScore')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-4xl font-semibold tabular-nums">{dashboard.score.score}<span className="ml-1 text-lg text-muted-foreground">/100</span></p>
          <div className="space-y-2">
            {dashboard.score.breakdown.map((c) => (
              <div key={c.key} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="tabular-nums text-muted-foreground">{c.points}/{c.max}</span>
                </div>
                <Progress value={c.points} max={c.max} label={c.label} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {dashboard.recommendations.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>{t('maintenance.recommendations')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dashboard.recommendations.map((r) => (
              <p key={r.key} className="text-sm text-muted-foreground">• {r.message}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Weekly report */}
      {report ? (
        <Card>
          <CardHeader><CardTitle>{t('maintenance.weeklyReport')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label={t('maintenance.avg7')} value={fmt(report.movingAverage)} suffix="kg" />
              <StatTile label={t('maintenance.daysInRange')} value={report.daysWithinRange} />
              <StatTile label={t('maintenance.avgCalories7')} value={fmt(report.averageCalories)} suffix="kcal" />
              <StatTile label={t('maintenance.trendDirection')} value={trendLabel(t, report.trend)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label={t('maintenance.mealLogging')} value={report.loggingCompletenessPercent} suffix="%" />
              <StatTile label={t('maintenance.proteinTarget')} value={report.proteinConsistencyPercent} suffix="%" />
              <StatTile label={t('maintenance.waterTracking')} value={report.waterConsistencyPercent} suffix="%" />
              <StatTile label={t('maintenance.activity')} value={report.activityConsistencyPercent} suffix="%" />
            </div>
            {report.previousWeekAverage !== null ? (
              <p className="text-sm text-muted-foreground">
                {t('maintenance.previousWeek')}: {report.previousWeekAverage} kg
                {report.averageDeltaKg !== null ? ` (${report.averageDeltaKg > 0 ? '+' : ''}${report.averageDeltaKg} kg)` : ''}
              </p>
            ) : null}
            <p className="text-sm"><span className="font-medium">{t('maintenance.suggestedNextAction')}:</span> {report.suggestedNextAction}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Mode settings */}
      <Card>
        <CardHeader><CardTitle>{t('maintenance.modeSettings')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['LOSS', 'MAINTENANCE', 'GAIN'] as Mode[]).map((m) => (
              <Button
                key={m}
                variant={m === mode ? 'primary' : 'secondary'}
                onClick={() => changeMode(m)}
              >
                {m === 'LOSS' ? t('maintenance.modeLoss') : m === 'MAINTENANCE' ? t('maintenance.modeMaintenance') : t('maintenance.modeGain')}
              </Button>
            ))}
          </div>
          {modeHistory.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('maintenance.modeHistory')}</p>
              {modeHistory.slice(0, 6).map((h) => (
                <p key={h.id} className="text-xs text-muted-foreground">
                  {h.startDate}{h.endDate ? `–${h.endDate}` : ''} · {h.mode}{h.reason ? ` · ${h.reason}` : ''}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Disclaimer text={t('maintenance.disclaimer')} />
    </div>
  );
}

function HabitBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value} max={100} label={label} />
    </div>
  );
}
