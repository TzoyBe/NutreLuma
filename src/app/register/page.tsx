import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/forms/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclaimer } from '@/components/ui/misc';
import { getT } from '@/i18n/locale';
import { googleAuthConfigured } from '@/server/env';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.registerTitle') };
}

export default async function RegisterPage() {
  const t = await getT();
  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Link href="/" className="mb-6 text-center text-lg font-semibold">
        {t('app.name')}
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
