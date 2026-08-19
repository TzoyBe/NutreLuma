import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/forms/reset-password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { LogoMark } from '@/components/brand/logo';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.resetTitle') };
}

export default async function ResetPasswordPage() {
  const t = await getT();

  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Link href="/" aria-label={t('app.name')} className="mb-7 flex flex-col items-center gap-3">
        <LogoMark className="h-14 w-14" title={t('app.name')} />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('auth.resetTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* useSearchParams απαιτεί Suspense boundary στο App Router. */}
          <Suspense fallback={<Skeleton className="h-48" />}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
