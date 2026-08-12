import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Κυκλικό «gauge» θερμίδων για το dashboard. Παρουσιαστικό component (server):
 * η γέμιση κινείται με καθαρό CSS, χωρίς client JS. Το τόξο έχει gradient +
 * λάμψη και έναν φωτεινό δείκτη στο τέλος της προόδου — iconic look πάνω στο
 * liquid glass της κάρτας.
 */

type CalorieGaugeProps = {
  consumed: number;
  target: number | null;
  remaining: number | null;
  overTarget: boolean;
  progressPercent: number;
  labels: {
    title: string;
    of: string; // π.χ. "από {target} kcal" ήδη μεταφρασμένο
    remaining: string;
    over: string;
    noTarget: string;
    kcal: string;
  };
};

const SIZE = 208;
const CENTER = SIZE / 2;
const RADIUS = 84;
const STROKE = 16;
const CIRC = 2 * Math.PI * RADIUS;

export function CalorieGauge({
  consumed,
  target,
  remaining,
  overTarget,
  progressPercent,
  labels,
}: CalorieGaugeProps) {
  const hasTarget = target !== null && target > 0;
  const fraction = hasTarget ? Math.max(0, Math.min(1, progressPercent / 100)) : 0;
  const dashoffset = CIRC * (1 - fraction);

  // Θέση του φωτεινού δείκτη στο τέλος του τόξου (αρχή στην κορυφή, -90°).
  const capAngle = (-90 + 360 * fraction) * (Math.PI / 180);
  const capX = CENTER + RADIUS * Math.cos(capAngle);
  const capY = CENTER + RADIUS * Math.sin(capAngle);

  const arcColor = overTarget ? 'hsl(var(--destructive))' : 'url(#gaugeGradient)';
  const glow = overTarget ? 'hsl(var(--destructive) / 0.55)' : 'hsl(var(--primary) / 0.5)';

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative aspect-square w-full max-w-[300px]">
        {/* Ambient χρωματιστή λάμψη πίσω από το gauge */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-6 rounded-full blur-2xl',
            overTarget ? 'bg-destructive/25' : 'bg-primary/20',
          )}
        />

        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative h-full w-full"
          role="img"
          aria-label={`${consumed} ${labels.kcal}${hasTarget ? ` / ${target}` : ''}`}
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="hsl(var(--primary))" />
              <stop offset="0.55" stopColor="hsl(var(--accent))" />
              <stop offset="1" stopColor="hsl(var(--primary))" />
            </linearGradient>
          </defs>

          {/* Λεπτά ticks γύρω-γύρω για «gauge» αίσθηση */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i * 6 - 90) * (Math.PI / 180);
            const rOuter = RADIUS + STROKE / 2 + 6;
            const rInner = rOuter - (i % 5 === 0 ? 6 : 3);
            return (
              <line
                key={i}
                x1={CENTER + rOuter * Math.cos(a)}
                y1={CENTER + rOuter * Math.sin(a)}
                x2={CENTER + rInner * Math.cos(a)}
                y2={CENTER + rInner * Math.sin(a)}
                stroke="hsl(var(--foreground))"
                strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
                opacity={i % 5 === 0 ? 0.22 : 0.1}
                strokeLinecap="round"
              />
            );
          })}

          {/* Track */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={STROKE}
            opacity={0.55}
          />

          {/* Progress arc */}
          {hasTarget ? (
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={arcColor}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashoffset}
                className="gauge-arc"
                style={{
                  ['--gauge-len' as string]: `${CIRC}`,
                  filter: `drop-shadow(0 0 7px ${glow})`,
                }}
              />
            </g>
          ) : null}

          {/* Φωτεινός δείκτης στο τέλος της προόδου */}
          {hasTarget && fraction > 0.02 ? (
            <g className="gauge-cap" style={{ transformOrigin: `${capX}px ${capY}px` }}>
              <circle cx={capX} cy={capY} r={7} fill="#ffffff" opacity={0.95} />
              <circle
                cx={capX}
                cy={capY}
                r={4}
                fill={overTarget ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
              />
            </g>
          ) : null}
        </svg>

        {/* Κέντρο: η ένδειξη */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Flame
            className={cn('h-5 w-5', overTarget ? 'text-destructive' : 'text-primary')}
            aria-hidden="true"
          />
          <span className="mt-1 text-4xl font-semibold tabular-nums leading-none text-foreground">
            {consumed}
          </span>
          <span className="mt-1.5 text-xs text-muted-foreground">
            {hasTarget ? labels.of : labels.kcal}
          </span>
          {hasTarget ? (
            <span
              className={cn(
                'mt-2 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1',
                overTarget
                  ? 'bg-destructive/12 text-destructive ring-destructive/20'
                  : 'bg-primary/12 text-primary ring-primary/20',
              )}
            >
              {progressPercent}%
            </span>
          ) : null}
        </div>
      </div>

      {/* Κάτω: κατάσταση */}
      {hasTarget ? (
        <p
          className={cn(
            'mt-4 text-sm font-medium',
            overTarget ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {overTarget ? labels.over : labels.remaining}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{labels.noTarget}</p>
      )}
    </div>
  );
}
