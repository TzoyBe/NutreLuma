'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Droplet, Footprints, SlidersHorizontal } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { angleFraction, applyAntiWrap, snapValue } from './radial-gauge-math';

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
const SNAP = 50;

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
  value,
  scaleMax,
  target,
  from,
  to,
  interactive,
  onCommit,
  children,
}: {
  value: number;            // committed value (consumed)
  scaleMax: number;         // value at fraction 1 (1.5 × target)
  target: number;           // 100%-of-goal marker position
  from: string;
  to: string;
  interactive: boolean;
  onCommit?: (newValue: number) => void;
  children: (displayValue: number) => React.ReactNode;
}) {
  const gid = React.useId();
  const svgRef = React.useRef<SVGSVGElement>(null);
  const prevFraction = React.useRef<number | null>(null);
  const [preview, setPreview] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const display = preview ?? value;
  const fraction = Math.max(0, Math.min(1, display / scaleMax));
  const offset = C * (1 - fraction);
  const targetFraction = Math.max(0, Math.min(1, target / scaleMax));

  // Everything is drawn in one screen-space frame: top = fraction 0, clockwise.
  // Only the arc circles get an SVG rotate(-90); the knob/tick are computed
  // directly here so they line up with the pointer math (which is also screen
  // space). Rotating the whole <svg> in CSS used to offset the knob by 90°,
  // which made drag-to-adjust feel broken.
  const knobAngle = (fraction * 360 - 90) * (Math.PI / 180);
  const knobX = SIZE / 2 + R * Math.cos(knobAngle);
  const knobY = SIZE / 2 + R * Math.sin(knobAngle);
  // target tick position
  const tickAngle = (targetFraction * 360 - 90) * (Math.PI / 180);
  const tickX1 = SIZE / 2 + (R - STROKE / 2) * Math.cos(tickAngle);
  const tickY1 = SIZE / 2 + (R - STROKE / 2) * Math.sin(tickAngle);
  const tickX2 = SIZE / 2 + (R + STROKE / 2) * Math.cos(tickAngle);
  const tickY2 = SIZE / 2 + (R + STROKE / 2) * Math.sin(tickAngle);

  const updateFromEvent = React.useCallback(
    (e: React.PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const raw = angleFraction(cx, cy, e.clientX, e.clientY);
      const f = applyAntiWrap(raw, prevFraction.current);
      prevFraction.current = f;
      setPreview(snapValue(f, scaleMax, SNAP));
    },
    [scaleMax],
  );

  const endDrag = React.useCallback(() => {
    setDragging(false);
    setPreview((next) => {
      prevFraction.current = null;
      if (next != null && next !== value) onCommit?.(next);
      return null;
    });
  }, [value, onCommit]);

  const rotate = `rotate(-90 ${SIZE / 2} ${SIZE / 2})`;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        className={interactive ? 'cursor-pointer' : ''}
        style={interactive ? { touchAction: 'none' } : undefined}
        onPointerDown={
          interactive
            ? (e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setDragging(true);
                prevFraction.current = Math.max(0, Math.min(1, value / scaleMax));
                updateFromEvent(e);
              }
            : undefined
        }
        onPointerMove={interactive ? (e) => { if (dragging) updateFromEvent(e); } : undefined}
        onPointerUp={interactive ? endDrag : undefined}
        onPointerCancel={interactive ? endDrag : undefined}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth={STROKE} opacity={0.6} />
        <circle
          transform={rotate}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={dragging ? undefined : { transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
        {interactive ? (
          <>
            <line x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2} stroke="hsl(var(--foreground))" strokeWidth={2} opacity={0.35} />
            {/* Grab handle — the round button the user drags around the ring. */}
            <circle cx={knobX} cy={knobY} r={STROKE / 2 + 5} fill={to} opacity={0.18} />
            <circle
              cx={knobX}
              cy={knobY}
              r={STROKE / 2 + 1}
              fill="white"
              stroke={to}
              strokeWidth={3}
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
            />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children(Math.round(display))}
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

  const WATER_DEFAULT = 3000;
  const STEPS_DEFAULT = 10000;
  const waterScaleMax = 1.5 * (waterTarget ?? WATER_DEFAULT);
  const stepsScaleMax = 1.5 * (goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_DEFAULT);

  const commitWater = (newTotal: number) => {
    const delta = Math.round(newTotal - waterMl);
    if (delta === 0) return;
    run('water-commit', () => api.post('/api/water', { entryDate: date, volumeMl: delta }));
  };
  const commitSteps = (newTotal: number) => {
    const delta = Math.round(newTotal - steps);
    if (delta === 0) return;
    run('steps-commit', () => api.post('/api/activity', { entryDate: date, kind: 'WALK', steps: delta }));
  };

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
          <Ring
            value={waterMl}
            scaleMax={waterScaleMax}
            target={waterTarget ?? WATER_DEFAULT}
            from="#38BDF8"
            to="#2563EB"
            interactive={isToday}
            onCommit={commitWater}
          >
            {(display) => (
              <>
                <Droplet className="h-4 w-4 text-sky-400" aria-hidden="true" />
                <span className="text-2xl font-bold tabular-nums">{display.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {waterTarget ? `of ${waterTarget.toLocaleString()} ml` : 'ml'}
                </span>
              </>
            )}
          </Ring>
          <p className="text-sm font-semibold">{t('dashboard.water')}</p>
          {isToday ? <p className="text-[11px] text-muted-foreground">{t('dashboard.dragToAdjust')}</p> : null}
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/40 p-4">
          <Ring
            value={steps}
            scaleMax={stepsScaleMax}
            target={goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_FALLBACK}
            from="#2DD4BF"
            to="#10B981"
            interactive={isToday}
            onCommit={commitSteps}
          >
            {(display) => (
              <>
                <Footprints className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span className="text-2xl font-bold tabular-nums">{display.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">of {stepsTarget.toLocaleString()}</span>
              </>
            )}
          </Ring>
          <p className="text-sm font-semibold">{t('dashboard.steps')}</p>
          {isToday ? <p className="text-[11px] text-muted-foreground">{t('dashboard.dragToAdjust')}</p> : null}
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
