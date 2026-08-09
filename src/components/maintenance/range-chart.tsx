'use client';

import * as React from 'react';

interface Point {
  date: string;
  value: number;
}

/**
 * Ελαφρύ inline-SVG γράφημα: ζώνη εύρους συντήρησης + γραμμή 7ήμερου μέσου όρου
 * + κουκκίδες ημερήσιων μετρήσεων. Χωρίς εξωτερικές εξαρτήσεις (CSP-safe),
 * theme-aware μέσω currentColor.
 */
export function RangeChart({
  points,
  range,
  rawPoints,
}: {
  points: Point[];
  range: { lower: number; upper: number };
  rawPoints: Point[];
}) {
  const width = 640;
  const height = 220;
  const pad = { top: 12, right: 12, bottom: 20, left: 32 };

  const allValues = [
    ...points.map((p) => p.value),
    ...rawPoints.map((p) => p.value),
    range.lower,
    range.upper,
  ];
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const spanV = maxV - minV || 1;
  const yMin = minV - spanV * 0.1;
  const yMax = maxV + spanV * 0.1;

  const n = Math.max(points.length, rawPoints.length, 1);
  const x = (i: number) =>
    pad.left + (n <= 1 ? 0 : (i / (n - 1)) * (width - pad.left - pad.right));
  const y = (v: number) =>
    pad.top + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);

  const bandTop = y(range.upper);
  const bandBottom = y(range.lower);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-56 w-full text-primary"
        role="img"
        aria-label="Maintenance range chart"
      >
        {/* Range band */}
        <rect
          x={pad.left}
          y={bandTop}
          width={width - pad.left - pad.right}
          height={Math.max(0, bandBottom - bandTop)}
          className="fill-primary/10"
        />
        <line x1={pad.left} x2={width - pad.right} y1={bandTop} y2={bandTop} className="stroke-primary/40" strokeDasharray="4 4" />
        <line x1={pad.left} x2={width - pad.right} y1={bandBottom} y2={bandBottom} className="stroke-primary/40" strokeDasharray="4 4" />

        {/* Raw daily points */}
        {rawPoints.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r={2} className="fill-muted-foreground/50" />
        ))}

        {/* 7-day average line */}
        <path d={line} fill="none" className="stroke-primary" strokeWidth={2} />

        {/* Y labels */}
        <text x={4} y={bandTop + 4} className="fill-muted-foreground text-[10px]">{range.upper}</text>
        <text x={4} y={bandBottom + 4} className="fill-muted-foreground text-[10px]">{range.lower}</text>
      </svg>
    </div>
  );
}
