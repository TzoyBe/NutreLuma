'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';

const LOCALES = ['el', 'en'] as const;

/** Εναλλαγή γλώσσας EL/EN. Γράφει cookie μέσω /api/locale και κάνει refresh. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function choose(locale: (typeof LOCALES)[number]) {
    if (locale === current || pending) return;
    setPending(true);
    try {
      await api.post('/api/locale', { locale });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn('liquid-control flex items-center rounded-full p-0.5', className)}
    >
      {LOCALES.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => void choose(locale)}
            disabled={pending}
            aria-pressed={active}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-60',
              active
                ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.9)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
