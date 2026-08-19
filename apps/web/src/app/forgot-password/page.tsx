import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/forms/forgot-password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.forgotTitle') };
}

export default async function ForgotPasswordPage() {
  const t = await getT();

  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Link href="/" aria-label={t('app.name')} className="mb-7 flex flex-col items-center gap-3">
        <LogoMark className="h-14 w-14" title={t('app.name')} />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('auth.forgotTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
