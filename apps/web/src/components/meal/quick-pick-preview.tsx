'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { MealType } from '@prisma/client';
import { api, ApiClientError } from '@/lib/api-client';
import { MEAL_TYPES } from '@/lib/constants';
import { generateRequestKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import type { QuickMacros, QuickPickPreviewResponse, QuickPickRef } from './quick-pick-types';

const SERVING_PRESETS = [0.5, 1, 1.5, 2] as const;

const MACRO_FIELDS = [
  { key: 'proteinGrams', label: 'meal.protein' },
  { key: 'carbohydrateGrams', label: 'meal.carbohydrate' },
  { key: 'fatGrams', label: 'meal.fat' },
  { key: 'fiberGrams', label: 'meal.fiber' },
  { key: 'sugarGrams', label: 'meal.sugar' },
  { key: 'saturatedFatGrams', label: 'meal.saturatedFat' },
  { key: 'sodiumMg', label: 'meal.sodium' },
] as const;

type NumKey = 'finalCalories' | keyof QuickMacros;

function toStr(value: number | null): string {
  return value === null || value === undefined ? '' : String(value);
}
function parseNum(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function QuickPickPreview({
  pickRef,
  defaultMealType,
  onClose,
}: {
  pickRef: QuickPickRef;
  defaultMealType: MealType;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const requestKey = React.useRef(generateRequestKey());
  const panelRef = React.useRef<HTMLDivElement>(null);

  const [multiplier, setMultiplier] = React.useState(1);
  const [customValue, setCustomValue] = React.useState('');
  const [preview, setPreview] = React.useState<QuickPickPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [mealType, setMealType] = React.useState<MealType>(defaultMealType);
  const [notes, setNotes] = React.useState('');
  const [fields, setFields] = React.useState<Record<NumKey, string>>({
    finalCalories: '',
    proteinGrams: '',
    carbohydrateGrams: '',
    fatGrams: '',
    fiberGrams: '',
    sugarGrams: '',
    saturatedFatGrams: '',
    sodiumMg: '',
  });

  // ESC + scroll lock.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Backend-authoritative scaling: κάθε αλλαγή multiplier ξανακαλεί το /preview.
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .post<QuickPickPreviewResponse>('/api/meals/quick-pick/preview', {
        ref: pickRef,
        servingMultiplier: multiplier,
      })
      .then((data) => {
        if (!active) return;
        setPreview(data);
        const c = data.composition;
        setFields({
          finalCalories: toStr(c.finalCalories),
          proteinGrams: toStr(c.macros.proteinGrams),
          carbohydrateGrams: toStr(c.macros.carbohydrateGrams),
          fatGrams: toStr(c.macros.fatGrams),
          fiberGrams: toStr(c.macros.fiberGrams),
          sugarGrams: toStr(c.macros.sugarGrams),
          saturatedFatGrams: toStr(c.macros.saturatedFatGrams),
          sodiumMg: toStr(c.macros.sodiumMg),
        });
      })
      .catch((error) => {
        if (!active) return;
        toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickRef, multiplier]);

  const setField = (key: NumKey, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const overrides: Record<string, number> = {};
      const cals = parseNum(fields.finalCalories);
      if (cals !== undefined) overrides.finalCalories = cals;
      for (const { key } of MACRO_FIELDS) {
        const n = parseNum(fields[key]);
        if (n !== undefined) overrides[key] = n;
      }
      await api.post('/api/meals/quick-pick', {
        ref: pickRef,
        servingMultiplier: multiplier,
        mealType,
        notes: notes.trim() || undefined,
        overrides,
        requestKey: requestKey.current,
      });
      toast.push(t('addMeal.added'), 'success');
      router.refresh();
      onClose();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const isCustom = !SERVING_PRESETS.includes(multiplier as (typeof SERVING_PRESETS)[number]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('addMeal.confirmAdd')}
        className="max-h-[90vh] w-full max-w-md animate-fade-in overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {preview?.title || t(`mealType.${mealType}` as never)}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </Button>
        </div>

        {/* Μερίδες */}
        <div className="mb-4">
          <p className="mb-1.5 text-sm font-medium">{t('addMeal.servings')}</p>
          <div className="flex flex-wrap gap-2">
            {SERVING_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setCustomValue('');
                  setMultiplier(p);
                }}
                className={`h-9 min-w-[3rem] rounded-lg border px-3 text-sm font-medium transition-colors ${
                  !isCustom && multiplier === p
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-secondary'
                }`}
              >
                {p}×
              </button>
            ))}
            <Input
              type="number"
              inputMode="decimal"
              min="0.1"
              max="20"
              step="0.1"
              value={customValue}
              placeholder={t('addMeal.custom')}
              onChange={(e) => {
                setCustomValue(e.target.value);
                const n = parseNum(e.target.value);
                if (n !== undefined && n > 0 && n <= 20) setMultiplier(n);
              }}
              className="h-9 w-24"
              aria-label={t('addMeal.custom')}
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <Field label={t('meal.type')} htmlFor="qp-type">
              <Select
                id="qp-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
              >
                {MEAL_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {t(`mealType.${mt}` as never)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('meal.calories')} htmlFor="qp-cals">
              <Input
                id="qp-cals"
                type="number"
                inputMode="numeric"
                value={fields.finalCalories}
                onChange={(e) => setField('finalCalories', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {MACRO_FIELDS.map(({ key, label }) => (
                <Field key={key} label={t(label as never)} htmlFor={`qp-${key}`}>
                  <Input
                    id={`qp-${key}`}
                    type="number"
                    inputMode="decimal"
                    value={fields[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>

            <Field label={t('meal.notes')} htmlFor="qp-notes">
              <Textarea
                id="qp-notes"
                rows={2}
                value={notes}
                placeholder={t('meal.notesPlaceholder')}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={confirm} loading={submitting} disabled={loading}>
            {t('addMeal.confirmAdd')}
          </Button>
        </div>
      </div>
    </div>
  );
}
