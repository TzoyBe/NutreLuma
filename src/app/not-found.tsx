import Link from 'next/link';
import { getT } from '@/i18n/locale';

export default async function NotFound() {
  const t = await getT();
  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">{t('errors.notFound')}</h1>
      <Link
        href="/dashboard"
        className="inline-flex h-11 items-center rounded-lg bg-primary px-5 font-medium text-primary-foreground"
      >
        {t('nav.dashboard')}
      </Link>
    </main>
  );
}
