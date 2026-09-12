import type * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { ProgressUniverseModel } from './progress-universe-model';

export function ProgressUniverse({
  model,
  title,
  labels,
}: {
  model: ProgressUniverseModel;
  title: string;
  labels: Record<'history' | 'stats' | 'insights', string>;
}): React.ReactElement {
  const delta = model.heroDeltaKg;
  const deltaLabel = delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta}`;

  return (
    <Card className="universe-app-hero universe-app-reveal overflow-hidden">
      <section className="universe-hero-orbit glass-specular" aria-labelledby="progress-universe-title">
        <h2 id="progress-universe-title" className="sr-only">{title}</h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="universe-hero-orbit-center">
          <span>{deltaLabel}</span>
          <span>kg</span>
        </div>
        {model.satellites.map((satellite) => (
          <Link
            key={satellite.key}
            href={satellite.href}
            className="universe-hero-satellite"
            data-tone={satellite.tone}
          >
            <span className="universe-hero-satellite-label">{labels[satellite.key]}</span>
            <span className="universe-hero-satellite-value">
              {satellite.value}
              <span>{satellite.unit}</span>
            </span>
          </Link>
        ))}
      </section>
    </Card>
  );
}
