import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { GoalUniverseModel } from './goals-universe-model';

export function GoalsUniverse({ model }: { model: GoalUniverseModel }): React.ReactElement {
  return (
    <Card className="goals-universe-card overflow-hidden">
      <section
        className="goals-universe glass-specular"
        aria-labelledby="goals-universe-title"
      >
        <h2 id="goals-universe-title" className="sr-only">
          Daily nutrition targets
        </h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="goals-universe-center">
          <span>{model.calories ?? '--'}</span>
          <span>kcal</span>
        </div>
        {model.macros.map((macro) => (
          <div
            key={macro.key}
            className={`goals-universe-macro goals-universe-macro-${macro.key}`}
            data-tone={macro.tone}
          >
            <span className="goals-universe-macro-label">{macro.label}</span>
            <span className="goals-universe-macro-value">
              {macro.value ?? '--'}
              <span>{macro.unit}</span>
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
