'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { CALORIE_LIMITS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

export interface GoalValues {
  calorieTarget: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  waterMl: number;
  stepsTarget: number | null;
}

export interface GoalSuggestionValues {
  calorieTarget: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
  waterMl: number;
}

export interface GoalHistoryRow {
  id: string;
  effectiveFrom: string;
  source: 'AUTO' | 'MANUAL';
  calorieTarget: number;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
}

/** Κενό = «χωρίς στόχο». Δεν στέλνουμε ποτέ 0 για μη ορισμένο στόχο. */
function optionalNumber(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function GoalsPanel({
  goal,
  suggestion,
  history,
}: {
  goal: GoalValues;
  suggestion: GoalSuggestionValues | null;
  history: GoalHistoryRow[];
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const str = (value: number | null) => (value === null ? '' : String(value));

  const [calories, setCalories] = React.useState(str(goal.calorieTarget));
  const [protein, setProtein] = React.useState(str(goal.proteinGrams));
  const [carbs, setCarbs] = React.useState(str(goal.carbohydrateGrams));
  const [fat, setFat] = React.useState(str(goal.fatGrams));
  const [fiber, setFiber] = React.useState(str(goal.fiberGrams));
  const [water, setWater] = React.useState(String(goal.waterMl));
  const [steps, setSteps] = React.useState(str(goal.stepsTarget));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  function applySuggestion() {
    if (!suggestion) return;
    setCalories(String(suggestion.calorieTarget));
    setProtein(String(suggestion.proteinGrams));
    setCarbs(String(suggestion.carbohydrateGrams));
    setFat(String(suggestion.fatGrams));
    setFiber(String(suggestion.fiberGrams));
    setWater(String(suggestion.waterMl));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});

    try {
      await api.put('/api/goals', {
        source: 'MANUAL',
        calorieTarget: Number(calories),
        proteinGrams: optionalNumber(protein),
        carbohydrateGrams: optionalNumber(carbs),
        fatGrams: optionalNumber(fat),
        fiberGrams: optionalNumber(fiber),
        waterMl: optionalNumber(water),
        stepsTarget: optionalNumber(steps),
      });
      toast.push(t('goals.saved'), 'success');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const fieldErrors = error.fieldErrors();
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: error.message });
        toast.push(error.message, 'error');
      } else {
        toast.push(t('errors.generic'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <form onSubmit={save} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={`${t('goals.calories')} (kcal)`}
                htmlFor="calorieTarget"
                error={errors.calorieTarget}
              >
                <Input
                  {...fieldAria('calorieTarget', errors.calorieTarget)}
                  type="number"
                  inputMode="numeric"
                  min={CALORIE_LIMITS.minDailyTarget}
                  max={CALORIE_LIMITS.maxDailyTarget}
                  step={10}
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  required
                />
              </Field>

              <Field label={`${t('goals.water')} (ml)`} htmlFor="waterMl" error={errors.waterMl}>
                <Input
                  {...fieldAria('waterMl', errors.waterMl)}
                  type="number"
                  inputMode="numeric"
                  min={200}
                  max={8000}
                  step={50}
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                />
              </Field>

              <Field label={t('goals.stepsTarget')} htmlFor="stepsTarget" error={errors.stepsTarget}>
                <Input
                  {...fieldAria('stepsTarget', errors.stepsTarget)}
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  max={100000}
                  step={500}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </Field>

              <Field
                label={`${t('goals.protein')} (g)`}
                htmlFor="proteinGrams"
                error={errors.proteinGrams}
              >
                <Input
                  {...fieldAria('proteinGrams', errors.proteinGrams)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </Field>

              <Field
                label={`${t('goals.carbohydrate')} (g)`}
                htmlFor="carbohydrateGrams"
                error={errors.carbohydrateGrams}
              >
                <Input
                  {...fieldAria('carbohydrateGrams', errors.carbohydrateGrams)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
              </Field>

              <Field label={`${t('goals.fat')} (g)`} htmlFor="fatGrams" error={errors.fatGrams}>
                <Input
                  {...fieldAria('fatGrams', errors.fatGrams)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                />
              </Field>

              <Field
                label={`${t('goals.fiber')} (g)`}
                htmlFor="fiberGrams"
                error={errors.fiberGrams}
              >
                <Input
                  {...fieldAria('fiberGrams', errors.fiberGrams)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                />
              </Field>
            </div>

            {errors.form ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.form}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" loading={saving} className="sm:flex-1">
                {t('common.save')}
              </Button>
              {suggestion ? (
                <Button type="button" variant="outline" onClick={applySuggestion}>
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  {t('goals.useSuggestion')}
                </Button>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              {suggestion ? t('goals.suggestionHint') : t('goals.noProfile')}
            </p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('goals.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('goals.historyEmpty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((row) => (
                <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {t('goals.effectiveFrom')} {row.effectiveFrom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        row.proteinGrams === null ? null : `${t('goals.protein')} ${row.proteinGrams}g`,
                        row.carbohydrateGrams === null
                          ? null
                          : `${t('goals.carbohydrate')} ${row.carbohydrateGrams}g`,
                        row.fatGrams === null ? null : `${t('goals.fat')} ${row.fatGrams}g`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums font-medium">{row.calorieTarget} kcal</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
