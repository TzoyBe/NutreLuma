'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Droplet, Footprints, Plus, SlidersHorizontal } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

/**
 * Water & Steps gauges για το web dashboard — parity με το mobile app: animated
 * gradient rings (draw-on με CSS transition), quick-add buttons και ένα inline
 * «Targets» panel για τους ημερήσιους στόχους. Οι mutations πάνε στα υπάρχοντα
 * /api/water, /api/activity, /api/goals και μετά κάνουμε router.refresh().
 */

const SIZE = 148;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const STEPS_FALLBACK = 10000;

interface GoalValues {
  calorieTarget: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  waterMl: number | null;
  stepsTarget: number | null;
}

function Ring({
  fraction,
  from,
  to,
  children,
}: {
  fraction: number;
  from: string;
  to: string;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = React.useState(C);
  const gid = React.useId();

  React.useEffect(() => {
    const clamped = Math.max(0, Math.min(1, fraction));
    const id = requestAnimationFrame(() => setOffset(C * (1 - clamped)));
    return () => cancelAnimationFrame(id);
  }, [fraction]);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={STROKE}
          opacity={0.6}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children}
      </div>
    </div>
  );
}

export function ActivityGauges({
  date,
  isToday,
  waterMl,
  steps,
  goal,
}: {
  date: string;
  isToday: boolean;
  waterMl: number;
  steps: number;
  goal: GoalValues;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const waterTarget = goal.waterMl && goal.waterMl > 0 ? goal.waterMl : null;
  const stepsTarget = goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_FALLBACK;

  const [busy, setBusy] = React.useState<string | null>(null);
  const [showTargets, setShowTargets] = React.useState(false);
  const [waterInput, setWaterInput] = React.useState(waterTarget ? String(waterTarget) : '');
  const [stepsInput, setStepsInput] = React.useState(goal.stepsTarget ? String(goal.stepsTarget) : '');

  async function run(key: string, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(key);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const addWater = (volumeMl: number) =>
    run(`water-${volumeMl}`, () => api.post('/api/water', { entryDate: date, volumeMl }));

  const addSteps = (value: number) =>
    run(`steps-${value}`, () => api.post('/api/activity', { entryDate: date, kind: 'WALK', steps: value }));

  const num = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const saveTargets = () =>
    run('targets', async () => {
      await api.put('/api/goals', {
        source: 'MANUAL',
        calorieTarget: goal.calorieTarget,
        proteinGrams: goal.proteinGrams,
        carbohydrateGrams: goal.carbohydrateGrams,
        fatGrams: goal.fatGrams,
        fiberGrams: goal.fiberGrams,
        waterMl: num(waterInput),
        stepsTarget: num(stepsInput),
      });
      setShowTargets(false);
    });

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">{isToday ? t('dashboard.today') : t('dashboard.day')}</h2>
        {isToday ? (
          <button
            type="button"
            onClick={() => setShowTargets((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {t('dashboard.targets')}
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/40 p-4">
          <Ring fraction={waterTarget ? waterMl / waterTarget : 0} from="#38BDF8" to="#2563EB">
            <Droplet className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <span className="text-2xl font-bold tabular-nums">{Math.round(waterMl).toLocaleString()}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {waterTarget ? `of ${waterTarget.toLocaleString()} ml` : 'ml'}
            </span>
          </Ring>
          <p className="text-sm font-semibold">{t('dashboard.water')}</p>
          {isToday ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addWater(250)} loading={busy === 'water-250'}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 250 ml
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addWater(500)} loading={busy === 'water-500'}>
                +500
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/40 p-4">
          <Ring fraction={steps / stepsTarget} from="#2DD4BF" to="#10B981">
            <Footprints className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span className="text-2xl font-bold tabular-nums">{Math.round(steps).toLocaleString()}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              of {stepsTarget.toLocaleString()}
            </span>
          </Ring>
          <p className="text-sm font-semibold">{t('dashboard.steps')}</p>
          {isToday ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addSteps(500)} loading={busy === 'steps-500'}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 500
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addSteps(1000)} loading={busy === 'steps-1000'}>
                +1000
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {showTargets ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
          <Field label={`${t('dashboard.water')} (ml)`} htmlFor="waterTargetInput">
            <Input
              id="waterTargetInput"
              type="number"
              inputMode="numeric"
              min={200}
              max={8000}
              step={50}
              value={waterInput}
              onChange={(e) => setWaterInput(e.target.value)}
            />
          </Field>
          <Field label={t('goals.stepsTarget')} htmlFor="stepsTargetInput">
            <Input
              id="stepsTargetInput"
              type="number"
              inputMode="numeric"
              min={1000}
              max={100000}
              step={500}
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={saveTargets} loading={busy === 'targets'}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
