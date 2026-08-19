import { cn } from '@/lib/utils';

/**
 * Λωρίδα συνέπειας: μία σειρά με ένα τετράγωνο ανά ημέρα, ο χρόνος κυλά
 * αριστερά→δεξιά όπως στο «Calories per day». Παρουσιαστικό component (server).
 */

type Day = { day: string; total: number; withinTarget: boolean | null };

type HeatLevel = 'noLog' | 'onTarget' | 'over' | 'logged';

/** ISO (YYYY-MM-DD) → dd/mm/yyyy. */
function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function levelFor(day: Day, target: number | null): HeatLevel {
  if (day.total <= 0) return 'noLog';
  if (target === null) return 'logged';
  return day.total <= target ? 'onTarget' : 'over';
}

const CELL: Record<HeatLevel, string> = {
  noLog: 'bg-muted/40',
  onTarget: 'bg-primary',
  over: 'bg-accent',
  logged: 'bg-primary',
};

export function ConsistencyHeatmap({
  days,
  target,
  legend,
}: {
  days: Day[];
  target: number | null;
  legend: { onTarget: string; over: string; noLog: string; logged: string };
}) {
  if (days.length === 0) return null;

  const legendItems = [
    { key: 'onTarget', cls: CELL.onTarget, label: legend.onTarget },
    { key: 'over', cls: CELL.over, label: legend.over },
    { key: 'noLog', cls: CELL.noLog, label: legend.noLog },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-0.5 sm:gap-1">
        {days.map((day) => {
          const level = levelFor(day, target);
          const label = ddmmyyyy(day.day);
          return (
            <div
              key={day.day}
              title={day.total > 0 ? `${label}: ${day.total} kcal` : label}
              className={cn('h-9 min-w-0 flex-1 rounded-[3px] sm:rounded-[4px]', CELL[level])}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{ddmmyyyy(days[0].day)}</span>
        <span className="tabular-nums">{ddmmyyyy(days[days.length - 1].day)}</span>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(target !== null
          ? legendItems
          : [{ key: 'logged', cls: CELL.logged, label: legend.logged }, legendItems[2]]
        ).map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('h-3 w-3 rounded-[3px]', item.cls)} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
