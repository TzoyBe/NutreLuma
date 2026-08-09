'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/client';

/** Δεν εμφανίζουμε ποτέ stack trace στον χρήστη. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error('ui_error', { digest: error.digest });
  }, [error]);

  return (
    <main className="container flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">{t('errors.generic')}</h1>
      <p className="text-sm text-muted-foreground">{t('common.error')}</p>
      <Button onClick={reset}>{t('common.retry')}</Button>
    </main>
  );
}
