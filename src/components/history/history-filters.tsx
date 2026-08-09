'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MEAL_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useT } from '@/i18n/client';

export interface HistoryFilterValues {
  from: string;
  to: string;
  mealType: string;
  search: string;
}

export function HistoryFilters({ initial }: { initial: HistoryFilterValues }) {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = React.useState(initial);

  const set = (key: keyof HistoryFilterValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (values.from) params.set('from', values.from);
    if (values.to) params.set('to', values.to);
    if (values.mealType) params.set('mealType', values.mealType);
    if (values.search) params.set('search', values.search);
    const queryString = params.toString();
    router.push(`/history${queryString ? `?${queryString}` : ''}`);
  }

  function reset() {
    setValues({ from: '', to: '', mealType: '', search: '' });
    router.push('/history');
  }

  return (
    <form onSubmit={apply} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('history.from')} htmlFor="from">
          <Input
            id="from"
            name="from"
            type="date"
            value={values.from}
            onChange={(e) => set('from', e.target.value)}
          />
        </Field>
        <Field label={t('history.to')} htmlFor="to">
          <Input
            id="to"
            name="to"
            type="date"
            value={values.to}
            onChange={(e) => set('to', e.target.value)}
          />
        </Field>
      </div>

      <Field label={t('history.mealType')} htmlFor="mealType">
        <Select
          id="mealType"
          name="mealType"
          value={values.mealType}
          onChange={(e) => set('mealType', e.target.value)}
        >
          <option value="">{t('common.all')}</option>
          {MEAL_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`mealType.${value}` as never)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('common.search')} htmlFor="search">
        <Input
          id="search"
          name="search"
          type="search"
          value={values.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder={t('history.searchPlaceholder')}
          maxLength={80}
        />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {t('common.apply')}
        </Button>
        <Button type="button" variant="outline" onClick={reset}>
          {t('common.reset')}
        </Button>
      </div>
    </form>
  );
}
