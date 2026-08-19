'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, ChevronDown, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { CALORIE_LIMITS, MEAL_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Disclaimer } from '@/components/ui/misc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AiLoader } from '@/components/ui/ai-loader';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FavoriteToggle } from '@/components/meal/favorite-toggle';
import { useToast } from '@/components/toast';
import { useT, type TranslateFn } from '@/i18n/client';

export interface MacroValues {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}

export type MealLifecycleStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'REVIEW_REQUIRED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED';

export interface MealDetailData {
  id: string;
  mealType: (typeof MEAL_TYPES)[number];
  title: string | null;
  notes: string | null;
  mealDateTimeLocal: string;
  status: MealLifecycleStatus;
  analysisStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  aiEstimatedCalories: number | null;
  finalCalories: number | null;
  aiMinCalories: number | null;
  aiMaxCalories: number | null;
  aiConfidence: number | null;
  aiModel: string | null;
  aiProvider: string | null;
  aiAnalyzedAtLabel: string | null;
  aiErrorCode: string | null;
  wasManuallyEdited: boolean;
  imageUrl: string | null;
  macros: MacroValues;
  items: Array<{
    id: string;
    name: string;
    estimatedQuantity: string | null;
    aiEstimatedCalories: number | null;
    finalCalories: number | null;
    aiMinCalories: number | null;
    aiMaxCalories: number | null;
    macros: MacroValues;
  }>;
  clarifications: Array<{
    id: string;
    questionId: string;
    question: string;
    options: string[];
    answer: string | null;
  }>;
}

/** Τα macros που έχουμε όντως τιμή για, έτοιμα για εμφάνιση. */
function macroRows(
  macros: MacroValues,
  t: TranslateFn,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: number | null, unit: string) => {
    if (value === null) return;
    rows.push({ label, value: `${Math.round(value * 10) / 10} ${unit}` });
  };
  push(t('meal.protein'), macros.proteinGrams, 'g');
  push(t('meal.carbohydrate'), macros.carbohydrateGrams, 'g');
  push(t('meal.fat'), macros.fatGrams, 'g');
  push(t('meal.fiber'), macros.fiberGrams, 'g');
  push(t('meal.sugar'), macros.sugarGrams, 'g');
  push(t('meal.saturatedFat'), macros.saturatedFatGrams, 'g');
  push(t('meal.sodium'), macros.sodiumMg, 'mg');
  return rows;
}

interface EditableItem {
  id?: string;
  name: string;
  estimatedQuantity: string;
  finalCalories: string;
}

export function MealDetail({ meal }: { meal: MealDetailData }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const [mealType, setMealType] = React.useState(meal.mealType);
  const [title, setTitle] = React.useState(meal.title ?? '');
  const [notes, setNotes] = React.useState(meal.notes ?? '');
  const [dateTime, setDateTime] = React.useState(meal.mealDateTimeLocal);
  const [totalCalories, setTotalCalories] = React.useState(String(meal.finalCalories ?? ''));
  const [items, setItems] = React.useState<EditableItem[]>(
    meal.items.map((item) => ({
      id: item.id,
      name: item.name,
      estimatedQuantity: item.estimatedQuantity ?? '',
      finalCalories: String(item.finalCalories ?? item.aiEstimatedCalories ?? 0),
    })),
  );
  const [acknowledgeHigh, setAcknowledgeHigh] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(meal.analysisStatus !== 'COMPLETED');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      meal.clarifications.filter((c) => c.answer !== null).map((c) => [c.questionId, c.answer!]),
    ),
  );
  const [clarifying, setClarifying] = React.useState(false);

  const isDraft =
    meal.status === 'PENDING' ||
    meal.status === 'ANALYZING' ||
    meal.status === 'REVIEW_REQUIRED' ||
    meal.status === 'FAILED';
  const unansweredQuestions = meal.clarifications.filter((c) => c.answer === null);
  const newAnswers = meal.clarifications.filter(
    (c) => c.answer === null && answers[c.questionId],
  );
  const totalMacroRows = macroRows(meal.macros, t);

  const itemsSum = items.reduce((sum, item) => sum + (Number(item.finalCalories) || 0), 0);
  const numericTotal = Number(totalCalories) || 0;
  const showHighWarning = numericTotal > CALORIE_LIMITS.softMaxPerMeal;

  const updateItem = (index: number, patch: Partial<EditableItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const removeItem = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  const addItem = () =>
    setItems((current) => [...current, { name: '', estimatedQuantity: '', finalCalories: '0' }]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});

    try {
      await api.patch(`/api/meals/${meal.id}`, {
        mealType,
        title,
        notes,
        mealDateTime: dateTime,
        finalCalories: Number(totalCalories) || 0,
        items: items
          .filter((item) => item.name.trim().length > 0)
          .map((item) => ({
            id: item.id,
            name: item.name.trim(),
            estimatedQuantity: item.estimatedQuantity,
            finalCalories: Number(item.finalCalories) || 0,
          })),
        acknowledgeHighCalories: acknowledgeHigh,
      });
      toast.push(t('toast.mealUpdated'), 'success');
      router.push('/dashboard');
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

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await api.post(`/api/meals/${meal.id}/analyze`);
      toast.push(t('toast.mealUpdated'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setRetrying(false);
    }
  }

  async function confirmMeal() {
    if (confirming) return;
    setConfirming(true);
    try {
      await api.post(`/api/meals/${meal.id}/confirm`, {
        acknowledgeHighCalories: acknowledgeHigh,
      });
      toast.push(t('meal.confirmed'), 'success');
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setConfirming(false);
    }
  }

  async function cancelDraft() {
    if (cancelling) return;
    setCancelling(true);
    try {
      await api.post(`/api/meals/${meal.id}/cancel`);
      toast.push(t('meal.cancelled'), 'success');
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  async function submitClarifications() {
    if (clarifying || newAnswers.length === 0) return;
    setClarifying(true);
    try {
      await api.post(`/api/meals/${meal.id}/clarify`, {
        answers: newAnswers.map((c) => ({
          questionId: c.questionId,
          answer: answers[c.questionId]!,
        })),
      });
      toast.push(t('toast.mealUpdated'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setClarifying(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api.delete(`/api/meals/${meal.id}`);
      toast.push(t('toast.mealDeleted'), 'success');
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Τα demo δεδομένα πρέπει να είναι αδύνατο να περαστούν για πραγματική ανάλυση. */}
      {meal.aiProvider === 'mock' ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-accent bg-accent/20 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <span>{t('meal.mockWarning')}</span>
        </div>
      ) : null}

      {/* Κύριο αποτέλεσμα */}
      <Card>
        {meal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meal.imageUrl}
            alt={t('meal.imageAlt')}
            className="h-52 w-full rounded-t-xl object-cover sm:h-64"
          />
        ) : null}
        <CardContent>
          {meal.analysisStatus === 'FAILED' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                <div>
                  <p className="font-medium text-destructive">{t('meal.analysisFailed')}</p>
                  <p className="text-sm text-muted-foreground">
                    {meal.aiErrorCode === 'NO_FOOD_DETECTED'
                      ? t('meal.noFoodDetected')
                      : t('meal.analysisFailedBody')}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={retry} loading={retrying}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('meal.resultTitle')}</p>
              <p className="text-4xl font-semibold tabular-nums">
                {meal.finalCalories ?? 0}
                <span className="ml-2 text-lg font-normal text-muted-foreground">kcal</span>
              </p>
              {meal.status === 'CONFIRMED' ? (
                <div className="flex items-center gap-2">
                  <FavoriteToggle refInput={{ kind: 'recent', mealId: meal.id }} initialFavorite={false} />
                  <span className="text-sm text-muted-foreground">{t('addMeal.saveFavorite')}</span>
                </div>
              ) : null}
              {meal.aiMinCalories !== null && meal.aiMaxCalories !== null ? (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {t('meal.calorieRange')}: {meal.aiMinCalories}–{meal.aiMaxCalories} kcal
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meal.status === 'CONFIRMED' ? 'primary' : 'accent'}>
                  {meal.status === 'CONFIRMED'
                    ? t('meal.statusConfirmed')
                    : meal.status === 'CANCELLED'
                      ? t('meal.statusCancelled')
                      : t('meal.statusDraft')}
                </Badge>
                <Badge tone={meal.wasManuallyEdited ? 'accent' : 'primary'}>
                  {meal.wasManuallyEdited ? t('dashboard.editedBadge') : t('dashboard.aiBadge')}
                </Badge>
                {meal.aiConfidence !== null ? (
                  <Badge tone="muted">
                    {t('meal.confidence')}: {Math.round(meal.aiConfidence * 100)}%
                  </Badge>
                ) : null}
                <Badge tone="muted">{t('app.estimateBadge')}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Διευκρινιστικές ερωτήσεις: εμφανίζονται μόνο όσο το γεύμα είναι πρόχειρο */}
      {isDraft && meal.clarifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('meal.clarificationsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('meal.clarificationsBody')}</p>

            {meal.clarifications.map((question) => (
              <fieldset key={question.id} className="space-y-2">
                <legend className="text-sm font-medium">
                  {question.question}
                  {question.answer !== null ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({t('meal.clarificationsAnswered')})
                    </span>
                  ) : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const selected = answers[question.questionId] === option;
                    return (
                      <label
                        key={option}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-muted'
                        } ${question.answer !== null ? 'cursor-default opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={question.questionId}
                          value={option}
                          checked={selected}
                          disabled={question.answer !== null || clarifying}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              [question.questionId]: option,
                            }))
                          }
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {unansweredQuestions.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={submitClarifications}
                loading={clarifying}
                disabled={newAnswers.length === 0}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {clarifying ? t('meal.clarificationsSubmitting') : t('meal.clarificationsSubmit')}
              </Button>
            ) : null}

            {clarifying ? <AiLoader title={t('meal.clarificationsSubmitting')} /> : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Μακροθρεπτικά συστατικά */}
      {totalMacroRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('meal.macros')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {totalMacroRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="tabular-nums font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {/* Επιβεβαίωση draft: το γεύμα δεν μετρά πουθενά μέχρι εδώ */}
      {isDraft && meal.finalCalories !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('meal.reviewTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('meal.reviewBody')}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={confirmMeal}
                loading={confirming}
                className="sm:flex-1"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {confirming ? t('meal.confirming') : t('meal.confirm')}
              </Button>
              {meal.imageUrl ? (
                <Button type="button" variant="outline" onClick={retry} loading={retrying}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('meal.reanalyze')}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setConfirmCancel(true)}>
                {t('meal.cancelDraft')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Λεπτομέρειες ανάλυσης */}
      {meal.items.length > 0 ? (
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-controls="analysis-details"
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <CardTitle>{t('meal.resultDetails')}</CardTitle>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </CardHeader>
          {detailsOpen ? (
            <CardContent id="analysis-details" className="space-y-3">
              <ul className="divide-y divide-border">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      {item.estimatedQuantity ? (
                        <p className="text-sm text-muted-foreground">{item.estimatedQuantity}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 tabular-nums text-muted-foreground">
                      {item.finalCalories ?? item.aiEstimatedCalories ?? 0} kcal
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meal.aiEstimatedCalories !== null ? (
                  <span>
                    {t('dashboard.aiBadge')}: {meal.aiEstimatedCalories} kcal
                  </span>
                ) : null}
                {meal.aiModel ? <span>Model: {meal.aiModel}</span> : null}
                {meal.aiAnalyzedAtLabel ? <span>{meal.aiAnalyzedAtLabel}</span> : null}
              </div>
              <Disclaimer text={t('app.disclaimer')} />
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {/* Χειροκίνητη διόρθωση */}
      <Card>
        <CardHeader>
          <CardTitle>{t('common.edit')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} noValidate className="space-y-4">
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

            <Field label={t('meal.notes')} htmlFor="notes" error={errors.notes}>
              <Textarea
                {...fieldAria('notes', errors.notes)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </Field>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t('meal.items')}</legend>
              {items.map((item, index) => (
                <div key={item.id ?? `new-${index}`} className="grid gap-2 sm:grid-cols-[1fr,7rem,6rem,auto]">
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
                    onClick={() => removeItem(index)}
                    aria-label={`${t('meal.removeItem')} ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('meal.addItem')}
              </Button>
            </fieldset>

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

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" loading={saving} className="sm:flex-1">
                {t('meal.saveChanges')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('common.delete')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title={t('meal.deleteConfirmTitle')}
        body={t('meal.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmCancel}
        title={t('meal.cancelDraftConfirmTitle')}
        body={t('meal.cancelDraftConfirmBody')}
        confirmLabel={t('meal.cancelDraft')}
        destructive
        loading={cancelling}
        onConfirm={cancelDraft}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
