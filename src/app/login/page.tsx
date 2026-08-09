import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/login-form';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { LogoMark } from '@/components/brand/logo';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.loginTitle') };
}

export default async function LoginPage() {
  const t = await getT();

  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      {/* Το λογότυπο αντικαθιστά τίτλο και υπότιτλο: λέει τα ίδια με λιγότερα. */}
      <Link href="/" aria-label={t('app.name')} className="mb-7 flex flex-col items-center gap-3">
        <LogoMark className="h-16 w-16" title={t('app.name')} />
        <span className="text-lg font-semibold tracking-tight">
          Nutre<span className="text-primary">luma</span>
        </span>
      </Link>

      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64" />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>

    </main>
  );
}
