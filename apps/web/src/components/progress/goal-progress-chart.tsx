'use client';

import * as React from 'react';

/**
 * Weight-to-goal progress chart για το web Progress page — parity με το mobile
 * GoalProgressChart: animated line/area (draw-on με CSS transition), διακεκομμένη
 * γραμμή στόχου, μεγάλο «% to goal» (direction-aware για απώλεια ή αύξηση) και
 * start/current/target. Καθαρές κενές καταστάσεις όταν λείπει στόχος ή δεδομένα.
 */

type Point = { entryDate: string; weightKg: number };

const W = 320;
const H = 168;
const PADX = 14;
const PADTOP = 18;
const PADBOT = 22;

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card/60 p-4">{children}</div>;
}

export function GoalProgressChart({
  points,
  targetWeightKg,
  unit = 'kg',
}: {
  points: Point[];
  targetWeightKg: number | null;
  unit?: string;
}) {
  const gid = React.useId();
  const fillId = React.useId();

  const sorted = React.useMemo(
    () =>
      [...points]
        .filter((p) => Number.isFinite(p.weightKg))
        .sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [points],
  );

  const hasTarget = targetWeightKg !== null && Number.isFinite(targetWeightKg);
  const enough = sorted.length >= 2;

  const geom = React.useMemo(() => {
    if (!hasTarget || !enough) return null;
    const target = targetWeightKg as number;
    const start = sorted[0]!.weightKg;
    const current = sorted[sorted.length - 1]!.weightKg;

    const values = sorted.map((p) => p.weightKg).concat([target, start]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = span * 0.15;
    const domMin = min - pad;
    const domMax = max + pad;
    const innerW = W - PADX * 2;
    const innerH = H - PADTOP - PADBOT;

    const xAt = (i: number) =>
      PADX + (sorted.length === 1 ? innerW / 2 : (innerW * i) / (sorted.length - 1));
    const yAt = (v: number) => PADTOP + innerH * (1 - (v - domMin) / (domMax - domMin));

    const coords = sorted.map((p, i) => ({ x: xAt(i), y: yAt(p.weightKg) }));
    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');
    const last = coords[coords.length - 1]!;
    const first = coords[0]!;
    const areaPath = `${linePath} L${last.x.toFixed(1)},${(H - PADBOT).toFixed(1)} L${first.x.toFixed(1)},${(H - PADBOT).toFixed(1)} Z`;

    let lineLength = 0;
    for (let i = 1; i < coords.length; i++) {
      lineLength += Math.hypot(coords[i]!.x - coords[i - 1]!.x, coords[i]!.y - coords[i - 1]!.y);
    }
    lineLength = Math.max(1, lineLength);

    const total = start - target;
    const pct =
      Math.abs(total) < 1e-6
        ? 100
        : Math.max(0, Math.min(100, Math.round(((start - current) / total) * 100)));

    return {
      target,
      start,
      current,
      targetY: yAt(target),
      last,
      linePath,
      areaPath,
      lineLength,
      pct,
      reached: Math.abs(current - target) < 0.15,
    };
  }, [sorted, hasTarget, enough, targetWeightKg]);

  const [offset, setOffset] = React.useState(9999);
  const [fade, setFade] = React.useState(0);
  React.useEffect(() => {
    if (!geom) return;
    setOffset(geom.lineLength);
    setFade(0);
    const id = requestAnimationFrame(() => {
      setOffset(0);
      setFade(1);
    });
    return () => cancelAnimationFrame(id);
  }, [geom]);

  if (!hasTarget) {
    return (
      <Shell>
        <p className="text-sm font-semibold">Goal progress</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a target weight in your profile to track progress toward your goal.
        </p>
      </Shell>
    );
  }

  if (!enough || !geom) {
    return (
      <Shell>
        <p className="text-sm font-semibold">Goal progress</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Log your weight at least twice to see your trend toward {Math.round(targetWeightKg as number)}
          {unit}.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goal progress</p>
          <p className="text-4xl font-bold tabular-nums">
            {geom.pct}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">% to goal</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div>
            <p className="text-[11px] text-muted-foreground">Current</p>
            <p className="text-sm font-semibold tabular-nums">{round1(geom.current)}{unit}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Target</p>
            <p className="text-sm font-semibold tabular-nums text-accent">{round1(geom.target)}{unit}</p>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ height: 'auto' }} role="img" aria-label="Weight toward goal">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFB703" />
            <stop offset="0.6" stopColor="#2563EB" />
            <stop offset="1" stopColor={geom.reached ? '#10B981' : '#2563EB'} />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity={0.34} />
            <stop offset="1" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
        </defs>

        <line
          x1={PADX}
          y1={geom.targetY}
          x2={W - PADX}
          y2={geom.targetY}
          stroke="#FFB703"
          strokeWidth={1.4}
          strokeDasharray="5 6"
          opacity={0.7}
        />

        <path
          d={geom.areaPath}
          fill={`url(#${fillId})`}
          style={{ opacity: fade, transition: 'opacity 0.9s ease-out 0.35s' }}
        />
        <path
          d={geom.linePath}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={geom.lineLength}
          strokeDashoffset={offset}
          style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1.05s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <circle
          cx={geom.last.x}
          cy={geom.last.y}
          r={4}
          fill={geom.reached ? '#10B981' : '#2563EB'}
          style={{ opacity: fade, transition: 'opacity 0.6s ease-out 0.5s' }}
        />
      </svg>

      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span>Start {round1(geom.start)}{unit}</span>
        <span>
          {geom.start - geom.current >= 0 ? '−' : '+'}
          {round1(Math.abs(geom.start - geom.current))}{unit} so far
        </span>
      </div>
    </Shell>
  );
}
