'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { healthProfileSchema } from '@/lib/validation/profile';
import { suggestDailyCalorieTarget } from '@/lib/calories';
import { ACTIVITY_LEVELS, GENDERS, GOALS, UNITS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input, Select } from '@/components/ui/field';
import { Disclaimer } from '@/components/ui/misc';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

export interface ProfileFormValues {
  birthDate: string;
  gender: (typeof GENDERS)[number];
  heightCm: string;
  currentWeightKg: string;
  targetWeightKg: string;
  activityLevel: (typeof ACTIVITY_LEVELS)[number];
  goal: (typeof GOALS)[number];
  dailyCalorieTarget: string;
  preferredUnits: (typeof UNITS)[number];
  timezone: string;
}

const EMPTY: ProfileFormValues = {
  birthDate: '',
  gender: 'UNDISCLOSED',
  heightCm: '',
  currentWeightKg: '',
  targetWeightKg: '',
  activityLevel: 'MODERATE',
  goal: 'MAINTAIN',
  dailyCalorieTarget: '',
  preferredUnits: 'METRIC',
  timezone: 'Europe/Athens',
};

function timezoneOptions(current: string): string[] {
  const fallback = [
    'Europe/Athens',
    'Europe/Berlin',
    'Europe/London',
    'Europe/Nicosia',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Australia/Sydney',
  ];
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  const list = typeof supported === 'function' ? supported('timeZone') : fallback;
  return list.includes(current) ? list : [current, ...list];
}

export function ProfileForm({
  initial,
  redirectTo,
  submitLabel,
}: {
  initial?: Partial<ProfileFormValues> | null;
  redirectTo?: string;
  submitLabel?: string;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = React.useState<ProfileFormValues>({
    ...EMPTY,
    timezone:
      initial?.timezone ??
      (typeof Intl !== 'undefined'
        ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? EMPTY.timezone)
        : EMPTY.timezone),
    ...(initial ?? {}),
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const suggestion = React.useMemo(() => {
    const height = Number(values.heightCm);
    const weight = Number(values.currentWeightKg);
    if (!values.birthDate || !Number.isFinite(height) || !Number.isFinite(weight)) return null;
    if (height < 80 || weight < 25) return null;
    const birthDate = new Date(`${values.birthDate}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime())) return null;
    return suggestDailyCalorieTarget({
      gender: values.gender,
      heightCm: height,
      weightKg: weight,
      birthDate,
      activityLevel: values.activityLevel,
      goal: values.goal,
    });
  }, [
    values.birthDate,
    values.heightCm,
    values.currentWeightKg,
    values.gender,
    values.activityLevel,
    values.goal,
  ]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setErrors({});

    const parsed = healthProfileSchema.safeParse({
      ...values,
      targetWeightKg: values.targetWeightKg === '' ? undefined : values.targetWeightKg,
      dailyCalorieTarget: values.dailyCalorieTarget === '' ? undefined : values.dailyCalorieTarget,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      await api.put('/api/profile', parsed.data);
      toast.push(t('toast.profileSaved'), 'success');
      if (redirectTo) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(error.fieldErrors());
        toast.push(error.message, 'error');
      } else {
        toast.push(t('errors.generic'), 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('onboarding.birthDate')} htmlFor="birthDate" error={errors.birthDate} required>
          <Input
            {...fieldAria('birthDate', errors.birthDate)}
            type="date"
            value={values.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </Field>

        <Field label={t('onboarding.gender')} htmlFor="gender" error={errors.gender}>
          <Select
            {...fieldAria('gender', errors.gender)}
            value={values.gender}
            onChange={(e) => set('gender', e.target.value as ProfileFormValues['gender'])}
          >
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {t(`gender.${value}` as never)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('onboarding.heightCm')} htmlFor="heightCm" error={errors.heightCm} required>
          <Input
            {...fieldAria('heightCm', errors.heightCm)}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="80"
            max="260"
            value={values.heightCm}
            onChange={(e) => set('heightCm', e.target.value)}
            required
          />
        </Field>

        <Field
          label={t('onboarding.currentWeightKg')}
          htmlFor="currentWeightKg"
          error={errors.currentWeightKg}
          required
        >
          <Input
            {...fieldAria('currentWeightKg', errors.currentWeightKg)}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="25"
            max="400"
            value={values.currentWeightKg}
            onChange={(e) => set('currentWeightKg', e.target.value)}
            required
          />
        </Field>

        <Field
          label={t('onboarding.targetWeightKg')}
          htmlFor="targetWeightKg"
          error={errors.targetWeightKg}
        >
          <Input
            {...fieldAria('targetWeightKg', errors.targetWeightKg)}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="25"
            max="400"
            value={values.targetWeightKg}
            onChange={(e) => set('targetWeightKg', e.target.value)}
          />
        </Field>

        <Field
          label={t('onboarding.activityLevel')}
          htmlFor="activityLevel"
          error={errors.activityLevel}
        >
          <Select
            {...fieldAria('activityLevel', errors.activityLevel)}
            value={values.activityLevel}
            onChange={(e) => set('activityLevel', e.target.value as ProfileFormValues['activityLevel'])}
          >
            {ACTIVITY_LEVELS.map((value) => (
              <option key={value} value={value}>
                {t(`activity.${value}` as never)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('onboarding.goal')} htmlFor="goal" error={errors.goal}>
          <Select
            {...fieldAria('goal', errors.goal)}
            value={values.goal}
            onChange={(e) => set('goal', e.target.value as ProfileFormValues['goal'])}
          >
            {GOALS.map((value) => (
              <option key={value} value={value}>
                {t(`goal.${value}` as never)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t('onboarding.dailyCalorieTarget')}
          htmlFor="dailyCalorieTarget"
          error={errors.dailyCalorieTarget}
          hint={t('onboarding.dailyCalorieTargetHint')}
        >
          <Input
            {...fieldAria('dailyCalorieTarget', errors.dailyCalorieTarget)}
            type="number"
            inputMode="numeric"
            step="10"
            min="800"
            max="8000"
            placeholder={suggestion ? String(suggestion) : ''}
            value={values.dailyCalorieTarget}
            onChange={(e) => set('dailyCalorieTarget', e.target.value)}
          />
        </Field>

        <Field
          label={t('onboarding.preferredUnits')}
          htmlFor="preferredUnits"
          error={errors.preferredUnits}
        >
          <Select
            {...fieldAria('preferredUnits', errors.preferredUnits)}
            value={values.preferredUnits}
            onChange={(e) => set('preferredUnits', e.target.value as ProfileFormValues['preferredUnits'])}
          >
            {UNITS.map((value) => (
              <option key={value} value={value}>
                {t(`units.${value}` as never)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('onboarding.timezone')} htmlFor="timezone" error={errors.timezone}>
          <Select
            {...fieldAria('timezone', errors.timezone)}
            value={values.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          >
            {timezoneOptions(values.timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {suggestion ? (
        <div className="rounded-xl border border-border bg-secondary/60 p-4">
          <p className="text-sm font-medium">
            {t('onboarding.suggested')}:{' '}
            <span className="tabular-nums">{suggestion} kcal</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('onboarding.suggestedNote')}</p>
        </div>
      ) : null}

      <Disclaimer text={t('app.disclaimer')} />

      <Button type="submit" size="lg" block loading={loading}>
        {submitLabel ?? t('onboarding.save')}
      </Button>
    </form>
  );
}
