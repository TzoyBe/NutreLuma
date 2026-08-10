import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/forms/login-form';
import { Card, CardContent } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.loginTitle') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;

  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Link href="/" aria-label={t('app.name')} className="mb-7 flex flex-col items-center gap-3">
        <LogoMark className="h-16 w-16" title={t('app.name')} />
        <span className="text-lg font-semibold tracking-tight">
          Nutre<span className="text-primary">luma</span>
        </span>
      </Link>

      <Card>
        <CardContent>
          <LoginForm nextPath={params.next} />
        </CardContent>
      </Card>
    </main>
  );
}
