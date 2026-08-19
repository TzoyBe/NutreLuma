import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'primary' | 'accent' | 'danger' | 'muted';
}) {
  const tones = {
    neutral: 'liquid-control text-secondary-foreground',
    primary: 'bg-primary/10 text-primary ring-1 ring-primary/15',
    accent: 'bg-accent/15 text-accent ring-1 ring-accent/20',
    danger: 'bg-destructive/10 text-destructive ring-1 ring-destructive/15',
    muted: 'bg-muted/70 text-muted-foreground ring-1 ring-border/60',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Progress({
  value,
  max = 100,
  over,
  label,
}: {
  value: number;
  max?: number;
  over?: boolean;
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="liquid-control h-3 w-full overflow-hidden rounded-full p-[2px]"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          over ? 'bg-destructive' : 'bg-primary',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Πρόοδος ενός μακροθρεπτικού. Χωρίς στόχο δείχνει μόνο την κατανάλωση —
 * ποτέ άδεια μπάρα που θα έμοιαζε με «0% επίτευξη».
 */
export function MacroBar({
  label,
  consumed,
  target,
  unit = 'g',
  over,
}: {
  label: string;
  consumed: number;
  target: number | null;
  unit?: string;
  over?: boolean;
}) {
  const rounded = Math.round(consumed * 10) / 10;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className={cn('font-medium', over && 'text-destructive')}>{rounded}</span>
          {target === null ? null : (
            <span className="text-muted-foreground"> / {target}</span>
          )}
          <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      {target === null ? (
        <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
      ) : (
        <div
          role="progressbar"
          aria-valuenow={Math.round(rounded)}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={label}
          className="liquid-control h-2.5 w-full overflow-hidden rounded-full p-[2px]"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              over ? 'bg-destructive' : 'bg-primary',
            )}
            style={{ width: `${Math.max(0, Math.min(100, (rounded / target) * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Disclaimer({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
          'liquid-control rounded-2xl p-3 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
    >
      {text}
    </p>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: 'default' | 'danger' | 'primary';
}) {
  return (
    // `glass-subtle`: ελαφρύτερο γυαλί, ώστε το πλακίδιο να ξεχωρίζει μέσα στην
    // κάρτα χωρίς να μοιάζει με ξένο, αδιαφανές κουτί.
    <div className="glass-subtle rounded-[calc(var(--radius)-0.35rem)] p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'danger' && 'text-destructive',
          tone === 'primary' && 'text-primary',
        )}
      >
        {value}
        {suffix ? <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span> : null}
      </p>
    </div>
  );
}
