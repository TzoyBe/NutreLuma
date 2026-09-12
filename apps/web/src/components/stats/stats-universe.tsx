import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { StatsUniverseModel } from './stats-universe-model';

export function StatsUniverse({
  model,
  title,
  heroLabel,
  labels,
}: {
  model: StatsUniverseModel;
  title: string;
  heroLabel: string;
  labels: Record<'average30' | 'weekTotal' | 'daysWithinTarget', string>;
}): React.ReactElement {
  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="stats-universe-title">
        <h2 id="stats-universe-title" className="sr-only">{title}</h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="universe-hero-orbit-center">
          <span>{model.hero}</span>
          <span>{heroLabel}</span>
        </div>
        {model.satellites.map((satellite) => (
          <div key={satellite.key} className="universe-hero-satellite" data-tone={satellite.tone}>
            <span className="universe-hero-satellite-label">{labels[satellite.key]}</span>
            <span className="universe-hero-satellite-value">
              {satellite.value}
              {satellite.unit ? <span>{satellite.unit}</span> : null}
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
