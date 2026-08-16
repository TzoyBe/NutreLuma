'use client';

import * as React from 'react';
import { useT } from '@/i18n/client';

/**
 * «Daily targets» display για το web Goals — parity με το mobile: κάρτες με
 * χρωματικό accent ανά θρεπτικό (brand nutrition colours) και animated count-up
 * των αριθμών κατά τη φόρτωση.
 */

function TargetStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
}) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (value === null) return undefined;
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border bg-card/60">
      <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
      <div className="flex flex-col justify-center gap-0.5 px-4 py-3">
        <p className="text-2xl font-bold tabular-nums">
          {value === null ? '--' : display.toLocaleString()}
          <span className="ml-1 text-xs font-semibold text-muted-foreground">{unit}</span>
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function GoalTargets({
  calories,
  protein,
  carbs,
  fat,
}: {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TargetStat label={t('goals.calories')} value={calories} unit="kcal" color="#3B6FF5" />
      <TargetStat label={t('goals.protein')} value={protein} unit="g" color="#38BDF8" />
      <TargetStat label={t('goals.carbohydrate')} value={carbs} unit="g" color="#FFB703" />
      <TargetStat label={t('goals.fat')} value={fat} unit="g" color="#A855F7" />
    </div>
  );
}
