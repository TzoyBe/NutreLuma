'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Droplet, Footprints } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { angleFraction, applyAntiWrap, snapValue } from './radial-gauge-math';

/**
 * Water & Steps gauges για το web dashboard — parity με το mobile app: animated
 * gradient rings (draw-on με CSS transition), quick-add buttons και ένα inline
 * «Targets» panel για τους ημερήσιους στόχους. Οι mutations πάνε στα υπάρχοντα
 * /api/water, /api/activity, /api/goals και μετά κάνουμε router.refresh().
 */

const SIZE = 160;
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
  size = SIZE,
  children,
}: {
  value: number;            // committed value (consumed)
  scaleMax: number;         // value at fraction 1 (1.5 × target)
  target: number;           // 100%-of-goal marker position
  from: string;
  to: string;
  interactive: boolean;
  onCommit?: (newValue: number) => void;
  /** Μέγεθος rendering — αριθμός (px) ή CSS τιμή (π.χ. clamp()). Η εσωτερική
   * γεωμετρία (viewBox) μένει πάντα στο module SIZE — ασφαλές να αλλάζει. */
  size?: number | string;
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
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={interactive ? 'h-full w-full cursor-pointer' : 'h-full w-full'}
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
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children(Math.round(display))}
      </div>
    </div>
  );
}

/**
 * Water/Steps rings — standalone, χωρίς κάρτα ή section wrapper, ώστε να
 * μπαίνουν μέσα στο ίδιο orbit-stage με τα macro rings (parity με το
 * native app). Ο στόχος (ml/βήματα) ρυθμίζεται πλέον από τη σελίδα Goals,
 * όχι εδώ — ίδια λογική με το native (μετακινήθηκε εκτός dashboard).
 */
export function WaterRing({
  date,
  isToday,
  waterMl,
  goal,
  className,
  size = 'clamp(116px, 12.5vw, 280px)',
}: {
  date: string;
  isToday: boolean;
  waterMl: number;
  goal: Pick<GoalValues, 'waterMl'>;
  className?: string;
  size?: number | string;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  const waterTarget = goal.waterMl && goal.waterMl > 0 ? goal.waterMl : null;
  const WATER_DEFAULT = 3000;
  const waterScaleMax = 1.5 * (waterTarget ?? WATER_DEFAULT);

  const commitWater = async (newTotal: number) => {
    const delta = Math.round(newTotal - waterMl);
    if (delta === 0 || busy) return;
    setBusy(true);
    try {
      await api.post('/api/water', { entryDate: date, volumeMl: delta });
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <Ring
        value={waterMl}
        scaleMax={waterScaleMax}
        target={waterTarget ?? WATER_DEFAULT}
        from="#38BDF8"
        to="#2563EB"
        interactive={isToday}
        onCommit={commitWater}
        size={size}
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
      <p className="mt-1 text-center text-sm font-semibold">{t('dashboard.water')}</p>
    </div>
  );
}

export function StepsRing({
  date,
  isToday,
  steps,
  goal,
  className,
  size = 'clamp(116px, 12.5vw, 280px)',
}: {
  date: string;
  isToday: boolean;
  steps: number;
  goal: Pick<GoalValues, 'stepsTarget'>;
  className?: string;
  size?: number | string;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  const stepsTarget = goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_FALLBACK;
  const STEPS_DEFAULT = 10000;
  const stepsScaleMax = 1.5 * (goal.stepsTarget && goal.stepsTarget > 0 ? goal.stepsTarget : STEPS_DEFAULT);

  const commitSteps = async (newTotal: number) => {
    const delta = Math.round(newTotal - steps);
    if (delta === 0 || busy) return;
    setBusy(true);
    try {
      await api.post('/api/activity', { entryDate: date, kind: 'WALK', steps: delta });
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <Ring
        value={steps}
        scaleMax={stepsScaleMax}
        target={stepsTarget}
        from="#2DD4BF"
        to="#10B981"
        interactive={isToday}
        onCommit={commitSteps}
        size={size}
      >
        {(display) => (
          <>
            <Footprints className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span className="text-2xl font-bold tabular-nums">{display.toLocaleString()}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">of {stepsTarget.toLocaleString()}</span>
          </>
        )}
      </Ring>
      <p className="mt-1 text-center text-sm font-semibold">{t('dashboard.steps')}</p>
    </div>
  );
}
