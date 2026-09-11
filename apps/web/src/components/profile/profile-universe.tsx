import type * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ProfileUniverseModel } from './profile-universe-model';

type ProfileUniverseLabels = {
  title: string;
  dailyTarget: string;
  planStatus: string;
  age: string;
  bmi: string;
};

export function ProfileUniverse({
  model,
  labels = { title: 'Profile', dailyTarget: 'Daily calorie target', planStatus: 'Plan', age: 'Age', bmi: 'BMI' },
}: {
  model: ProfileUniverseModel;
  labels?: ProfileUniverseLabels;
}): React.ReactElement {
  return (
    <Card className="profile-universe-card overflow-hidden">
      <section className="profile-universe" aria-labelledby="profile-universe-title">
        <CardContent className="space-y-6">
          <h2 id="profile-universe-title" className="sr-only">{labels.title}</h2>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="profile-universe-avatar flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-2xl font-semibold text-foreground"
              aria-hidden="true"
            >
              {model.initials}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="profile-universe-name break-words font-display text-2xl font-semibold sm:text-3xl">{model.displayName}</p>
              <p className="break-all text-sm text-muted-foreground">{model.email}</p>
              <p className="text-sm text-muted-foreground">{labels.planStatus}: {model.planStatus}</p>
            </div>
            <div className="profile-universe-target shrink-0">
              <p className="text-xs font-semibold text-muted-foreground">{labels.dailyTarget}</p>
              <p className="text-3xl font-semibold tabular-nums">
                {model.dailyTarget} <span className="text-sm text-muted-foreground">kcal</span>
              </p>
            </div>
          </div>
          <dl className="profile-universe-chips flex flex-wrap gap-3">
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-2">
              <dt className="text-xs text-muted-foreground">{labels.age}</dt>
              <dd className="font-semibold tabular-nums">{model.age}</dd>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-2">
              <dt className="text-xs text-muted-foreground">{labels.bmi}</dt>
              <dd className="font-semibold tabular-nums">
                {model.bmi}{model.bmiLabel !== '--' ? <span className="ml-2 text-xs font-normal text-muted-foreground">{model.bmiLabel}</span> : null}
              </dd>
            </div>
          </dl>
        </CardContent>
      </section>
    </Card>
  );
}
