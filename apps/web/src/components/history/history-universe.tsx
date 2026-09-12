import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { HistoryUniverseModel } from './history-universe-model';

export function HistoryUniverse({
  model,
  title,
  heroLabel,
  labels,
}: {
  model: HistoryUniverseModel;
  title: string;
  heroLabel: string;
  labels: Record<'weekTotal' | 'weekAverage' | 'monthAverage', string>;
}): React.ReactElement {
  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="history-universe-title">
        <h2 id="history-universe-title" className="sr-only">{title}</h2>
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
              <span>{satellite.unit}</span>
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
