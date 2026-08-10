'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysISO } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useT } from '@/i18n/client';

/** Πλοήγηση ανά ημέρα + date picker. Ενημερώνει το ?date= του server component. */
export function DateNav({
  date,
  maxDate,
  basePath = '/dashboard',
  label,
}: {
  date: string;
  maxDate: string;
  basePath?: string;
  label: string;
}) {
  const t = useT();
  const router = useRouter();
  const go = (next: string) => {
    if (next > maxDate) return;
    router.push(`${basePath}?date=${next}`);
  };

  return (
    <div className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => go(addDaysISO(date, -1))}
        aria-label={t('dashboard.prevDay')}
        className="shrink-0"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="min-w-0">
        <label htmlFor="date-picker" className="sr-only">
          {t('dashboard.pickDate')}
        </label>
        <Input
          id="date-picker"
          type="date"
          value={date}
          max={maxDate}
          onChange={(event) => event.target.value && go(event.target.value)}
          className="h-10 rounded-xl text-sm sm:text-base"
          aria-describedby="date-label"
        />
        <span id="date-label" className="sr-only">
          {label}
        </span>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => go(addDaysISO(date, 1))}
        disabled={date >= maxDate}
        aria-label={t('dashboard.nextDay')}
        className="shrink-0"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
