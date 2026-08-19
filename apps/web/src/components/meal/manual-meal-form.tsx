'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { CALORIE_LIMITS, MEAL_TYPES } from '@/lib/constants';
import { generateRequestKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

interface EditableItem {
  name: string;
  estimatedQuantity: string;
  finalCalories: string;
}

/** Κενό = «δεν γνωρίζω». Δεν στέλνουμε ποτέ 0 για άγνωστη τιμή. */
function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ManualMealForm({ defaultDateTime }: { defaultDateTime: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const [mealType, setMealType] = React.useState<(typeof MEAL_TYPES)[number]>('OTHER');
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [dateTime, setDateTime] = React.useState(defaultDateTime);
  const [totalCalories, setTotalCalories] = React.useState('');
  const [protein, setProtein] = React.useState('');
  const [carbs, setCarbs] = React.useState('');
  const [fat, setFat] = React.useState('');
  const [fiber, setFiber] = React.useState('');
  const [items, setItems] = React.useState<EditableItem[]>([]);
  const [acknowledgeHigh, setAcknowledgeHigh] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Το idempotency key παράγεται μία φορά ανά φόρμα: διπλό submit (π.χ. διπλό
  // πάτημα ή retry του browser) δεν δημιουργεί δεύτερη εγγραφή.
  const requestKey = React.useMemo(() => generateRequestKey(), []);

  const itemsSum = items.reduce((sum, item) => sum + (Number(item.finalCalories) || 0), 0);
  const effectiveTotal = optionalNumber(totalCalories) ?? itemsSum;
  const showHighWarning = effectiveTotal > CALORIE_LIMITS.softMaxPerMeal;

  const updateItem = (index: number, patch: Partial<EditableItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});

    try {
      const { meal } = await api.post<{ meal: { id: string } }>('/api/meals', {
        mealType,
        mealDateTime: dateTime,
        title,
        notes,
        finalCalories: optionalNumber(totalCalories),
        proteinGrams: optionalNumber(protein),
        carbohydrateGrams: optionalNumber(carbs),
        fatGrams: optionalNumber(fat),
        fiberGrams: optionalNumber(fiber),
        items: items
          .filter((item) => item.name.trim().length > 0)
          .map((item) => ({
            name: item.name.trim(),
            estimatedQuantity: item.estimatedQuantity,
            finalCalories: Number(item.finalCalories) || 0,
          })),
        acknowledgeHighCalories: acknowledgeHigh,
        requestKey,
      });
      toast.push(t('meal.confirmed'), 'success');
      router.push(`/meals/${meal.id}`);
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
    <Card>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('meal.type')} htmlFor="mealType" error={errors.mealType}>
              <Select
                {...fieldAria('mealType', errors.mealType)}
                value={mealType}
                onChange={(e) => setMealType(e.target.value as typeof mealType)}
              >
                {MEAL_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`mealType.${value}` as never)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('meal.dateTime')} htmlFor="mealDateTime" error={errors.mealDateTime}>
              <Input
                {...fieldAria('mealDateTime', errors.mealDateTime)}
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
              />
            </Field>

            <Field label={t('meal.titleField')} htmlFor="title" error={errors.title}>
              <Input
                {...fieldAria('title', errors.title)}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </Field>

            <Field
              label={t('meal.totalCalories')}
              htmlFor="finalCalories"
              error={errors.finalCalories}
              hint={items.length > 0 ? `${t('meal.items')}: ${itemsSum} kcal` : undefined}
            >
              <Input
                {...fieldAria('finalCalories', errors.finalCalories)}
                type="number"
                inputMode="numeric"
                min={0}
                max={CALORIE_LIMITS.hardMaxPerMeal}
                step={1}
                value={totalCalories}
                onChange={(e) => setTotalCalories(e.target.value)}
              />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('meal.macros')}</legend>
            <p className="text-xs text-muted-foreground">{t('meal.manualHint')}</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={`${t('meal.protein')} (g)`} htmlFor="proteinGrams">
                <Input
                  id="proteinGrams"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </Field>
              <Field label={`${t('meal.carbohydrate')} (g)`} htmlFor="carbohydrateGrams">
                <Input
                  id="carbohydrateGrams"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                />
              </Field>
              <Field label={`${t('meal.fat')} (g)`} htmlFor="fatGrams">
                <Input
                  id="fatGrams"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                />
              </Field>
              <Field label={`${t('meal.fiber')} (g)`} htmlFor="fiberGrams">
                <Input
                  id="fiberGrams"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={fiber}
                  onChange={(e) => setFiber(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('meal.items')}</legend>
            {items.map((item, index) => (
              <div key={`item-${index}`} className="grid gap-2 sm:grid-cols-[1fr,7rem,6rem,auto]">
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                  aria-label={`${t('meal.itemName')} ${index + 1}`}
                  placeholder={t('meal.itemName')}
                  maxLength={120}
                />
                <Input
                  value={item.estimatedQuantity}
                  onChange={(e) => updateItem(index, { estimatedQuantity: e.target.value })}
                  aria-label={`${t('meal.quantity')} ${index + 1}`}
                  placeholder={t('meal.quantity')}
                  maxLength={60}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={CALORIE_LIMITS.hardMaxPerMeal}
                  value={item.finalCalories}
                  onChange={(e) => updateItem(index, { finalCalories: e.target.value })}
                  aria-label={`${t('meal.calories')} ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  aria-label={`${t('meal.removeItem')} ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { name: '', estimatedQuantity: '', finalCalories: '0' },
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('meal.addItem')}
            </Button>
          </fieldset>

          <Field label={t('meal.notes')} htmlFor="notes" error={errors.notes}>
            <Textarea
              {...fieldAria('notes', errors.notes)}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </Field>

          {showHighWarning ? (
            <label className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={acknowledgeHigh}
                onChange={(e) => setAcknowledgeHigh(e.target.checked)}
              />
              <span>
                <strong className="block">{t('meal.highCaloriesWarning')}</strong>
                {t('meal.highCaloriesAck')}
              </span>
            </label>
          ) : null}

          {errors.form ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.form}
            </p>
          ) : null}

          <Button type="submit" loading={saving} className="w-full">
            {t('meal.manualSave')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
