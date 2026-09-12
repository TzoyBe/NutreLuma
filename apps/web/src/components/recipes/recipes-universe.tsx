import type * as React from 'react';
import { Card } from '@/components/ui/card';
import type { RecipeUniverseModel } from './recipes-universe-model';

type RecipesUniverseLabels = {
  title: string;
  protein: string;
  carbohydrate: string;
  fat: string;
};

export function RecipesUniverse({
  model,
  labels,
}: {
  model: RecipeUniverseModel;
  labels: RecipesUniverseLabels;
}): React.ReactElement {
  return (
    <Card className="recipes-universe-card universe-app-hero universe-app-reveal overflow-hidden">
      <section
        className="recipes-universe glass-specular"
        aria-labelledby="recipes-universe-title"
      >
        <h2 id="recipes-universe-title" className="sr-only">
          {labels.title}
        </h2>
        <div className="universe-app-orbit" aria-hidden="true" />
        <div className="recipes-universe-center">
          <span>{model.calories ?? '--'}</span>
          <span>kcal</span>
        </div>
        {model.macros.map((macro) => (
          <div
            key={macro.key}
            className={`recipes-universe-macro recipes-universe-macro-${macro.key}`}
            data-tone={macro.tone}
          >
            <span className="recipes-universe-macro-label">{labels[macro.key]}</span>
            <span className="recipes-universe-macro-value">
              {macro.value ?? '--'}
              <span>{macro.unit}</span>
            </span>
          </div>
        ))}
      </section>
    </Card>
  );
}
