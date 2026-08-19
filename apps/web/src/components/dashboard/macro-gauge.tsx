import { cn } from '@/lib/utils';

/**
 * Κυκλικό gauge ενός μακροθρεπτικού, στο ίδιο ύφος με το μεγάλο gauge θερμίδων
 * (ticks + χρωματιστή λάμψη). Χρώμα ανά μακροθρεπτικό για γρήγορη διάκριση.
 * Παρουσιαστικό component (server) — η γέμιση κινείται με καθαρό CSS.
 */

type MacroGaugeProps = {
  label: string;
  consumed: number;
  target: number | null;
  over: boolean;
  color: string; // CSS color, π.χ. "hsl(168 76% 55%)"
  unit?: string;
};

const SIZE = 132;
const CENTER = SIZE / 2;
const RADIUS = 52;
const STROKE = 11;
const CIRC = 2 * Math.PI * RADIUS;

export function MacroGauge({ label, consumed, target, over, color, unit = 'g' }: MacroGaugeProps) {
  const rounded = Math.round(consumed);
  const hasTarget = target !== null && target > 0;
  const fraction = hasTarget ? Math.max(0, Math.min(1, consumed / target)) : 0;
  const dashoffset = CIRC * (1 - fraction);
  const stroke = over ? 'hsl(var(--destructive))' : color;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Χρωματιστή λάμψη πίσω από το gauge */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-5 rounded-full blur-xl"
          style={{ background: stroke, opacity: over ? 0.22 : 0.16 }}
        />

        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative h-full w-full" aria-hidden="true">
          {/* Ticks */}
          {Array.from({ length: 40 }).map((_, i) => {
            const a = (i * 9 - 90) * (Math.PI / 180);
            const rOuter = RADIUS + STROKE / 2 + 5;
            const rInner = rOuter - (i % 5 === 0 ? 5 : 2.5);
            return (
              <line
                key={i}
                x1={CENTER + rOuter * Math.cos(a)}
                y1={CENTER + rOuter * Math.sin(a)}
                x2={CENTER + rInner * Math.cos(a)}
                y2={CENTER + rInner * Math.sin(a)}
                stroke="hsl(var(--foreground))"
                strokeWidth={i % 5 === 0 ? 1.2 : 0.7}
                opacity={i % 5 === 0 ? 0.2 : 0.09}
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
            opacity={0.5}
          />

          {/* Progress arc */}
          {hasTarget ? (
            <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={stroke}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashoffset}
                className="gauge-arc"
                style={{
                  ['--gauge-len' as string]: `${CIRC}`,
                  filter: `drop-shadow(0 0 6px ${stroke})`,
                }}
              />
            </g>
          ) : null}
        </svg>

        {/* Κέντρο */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-baseline gap-0.5">
            <span className={cn('text-2xl font-semibold tabular-nums', over && 'text-destructive')}>
              {rounded}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </span>
        </div>
      </div>

      <div className="text-center leading-tight">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hasTarget ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            / {target}
            {unit}
          </p>
        ) : null}
      </div>
    </div>
  );
}
