'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Branded AI loader (parity με το mobile AiSpinner/AiLoadingCard): περιστρεφόμενο
 * gradient ring (gold→blue→violet) + μήνυμα, για τις στιγμές που περιμένουμε το
 * AI (ανάλυση γεύματος, refinement, δημιουργία recipe plan).
 */
export function AiLoader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  const gid = React.useId();
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-8 text-center', className)}>
      <svg viewBox="0 0 48 48" className="h-12 w-12 animate-spin" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFB703" />
            <stop offset="0.5" stopColor="#2563EB" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--secondary))" strokeWidth="5" opacity="0.5" />
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="88 126"
        />
      </svg>
      <p className="text-sm font-semibold">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
