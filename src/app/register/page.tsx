import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/forms/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo';
import { Disclaimer } from '@/components/ui/misc';
import { getT } from '@/i18n/locale';
import { googleAuthConfigured } from '@/server/env';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.registerTitle') };
}

export default async function RegisterPage() {
  const t = await getT();
  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Link href="/" aria-label={t('app.name')} className="mb-7 flex flex-col items-center gap-3">
        <LogoMark className="h-16 w-16" title={t('app.name')} />
        <span className="text-lg font-semibold tracking-tight">
          Nutre<span className="text-primary">luma</span>
        </span>
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('auth.registerTitle')}</CardTitle>
          <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RegisterForm googleEnabled={googleAuthConfigured} />
          <Disclaimer text={t('app.disclaimer')} />
        </CardContent>
      </Card>
    </main>
  );
}
