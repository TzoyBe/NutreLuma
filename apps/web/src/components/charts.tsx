'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Ελαφριά, χωρίς εξαρτήσεις SVG charts. Κάθε chart έχει και προσβάσιμη
 * εναλλακτική (πίνακας/λίστα) για screen readers.
 */

export interface BarPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

export function BarChart({
  data,
  targetLine,
  ariaLabel,
  height = 160,
}: {
  data: BarPoint[];
  targetLine?: number | null;
  ariaLabel: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value), targetLine ?? 0);
  const barWidth = 100 / Math.max(1, data.length);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        {targetLine ? (
          <line
            x1="0"
            x2="100"
            y1={height - (targetLine / max) * height}
            y2={height - (targetLine / max) * height}
            stroke="hsl(var(--accent))"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {data.map((point, index) => {
          const barHeight = (point.value / max) * (height - 6);
          return (
            <rect
              key={point.label}
              x={index * barWidth + barWidth * 0.15}
              y={height - barHeight}
              width={barWidth * 0.7}
              height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
              rx="1"
              fill={point.highlight ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}
              opacity={point.value > 0 ? 1 : 0.25}
            />
          );
        })}
      </svg>
      <figcaption className="sr-only">
        <ul>
          {data.map((point) => (
            <li key={point.label}>{`${point.label}: ${point.value} kcal`}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function LineChart({
  data,
  ariaLabel,
  height = 160,
  unit = 'kg',
}: {
  data: Array<{ label: string; value: number }>;
  ariaLabel: string;
  height?: number;
  unit?: string;
}) {
  if (data.length === 0) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = data.length > 1 ? 100 / (data.length - 1) : 0;

  const points = data
    .map((point, index) => {
      const x = index * step;
      const y = height - 8 - ((point.value - min) / span) * (height - 16);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="sr-only">
        <ul>
          {data.map((point) => (
            <li key={point.label}>{`${point.label}: ${point.value} ${unit}`}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function DistributionBar({
  slices,
  ariaLabel,
}: {
  slices: Array<{ label: string; percent: number; total: number }>;
  ariaLabel: string;
}) {
  const palette = [
    'bg-primary',
    'bg-accent',
    'bg-primary/70',
    'bg-accent/70',
    'bg-primary/40',
    'bg-muted-foreground/40',
  ];
  const visible = slices.filter((slice) => slice.percent > 0);

  if (visible.length === 0) return null;

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label={ariaLabel}>
        {visible.map((slice, index) => (
          <div
            key={slice.label}
            className={cn(palette[index % palette.length])}
            style={{ width: `${slice.percent}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {visible.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full', palette[index % palette.length])}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{slice.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {slice.total} kcal · {slice.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
