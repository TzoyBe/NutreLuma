import type { Metadata } from 'next';
import type * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo';
import { ResendVerificationForm } from '@/components/forms/resend-verification-form';
import { getT } from '@/i18n/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Verify email' };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const status = params.status;
  const email = params.email ?? '';

  let content: React.ReactNode;
  if (status === 'success') {
    content = (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-11 w-11 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium">Email verified</p>
          <p className="text-sm text-muted-foreground">
            Your account is active. You can now log in and continue setup.
          </p>
        </div>
        <Link href="/login" className="inline-block text-sm text-primary underline underline-offset-4">
          Log in
        </Link>
      </div>
    );
  } else if (status === 'failed') {
    content = (
      <div className="space-y-5">
        <div className="space-y-3 text-center">
          <XCircle className="mx-auto h-11 w-11 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Verification link expired</p>
            <p className="text-sm text-muted-foreground">
              Request a new link and use the latest email we send you.
            </p>
          </div>
        </div>
        <ResendVerificationForm initialEmail={email} />
      </div>
    );
  } else {
    content = (
      <div className="space-y-5">
        <div className="space-y-3 text-center">
          <MailCheck className="mx-auto h-11 w-11 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a verification link. Confirm your email before logging in.
            </p>
          </div>
        </div>
        <ResendVerificationForm initialEmail={email} />
      </div>
    );
  }

  return (
    <main id="main" className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Link href="/" aria-label={t('app.name')} className="mb-7 flex flex-col items-center gap-3">
        <LogoMark className="h-14 w-14" title={t('app.name')} />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Verify email</CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </main>
  );
}
