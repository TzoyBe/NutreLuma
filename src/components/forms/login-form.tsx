'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chrome } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { loginSchema } from '@/lib/validation/auth';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, fieldAria, Input } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';

export function LoginForm({
  nextPath,
  googleEnabled,
  initialError,
}: {
  nextPath?: string;
  googleEnabled?: boolean;
  initialError?: string;
}) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      const result = await api.post<{ needsProfile: boolean }>('/api/auth/login', parsed.data);
      const destination = result.needsProfile ? '/onboarding' : (nextPath ?? '/dashboard');
      router.replace(destination.startsWith('/') ? destination : '/dashboard');
      router.refresh();
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : t('errors.generic');
      setErrors({ password: message });
      toast.push(message, 'error');
      setLoading(false);
    }
  }

  const googleHref = nextPath
    ? `/api/auth/google?next=${encodeURIComponent(nextPath)}`
    : '/api/auth/google';

  return (
    <div className="space-y-4">
      {initialError ? (
        <p role="alert" className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {initialError}
        </p>
      ) : null}

      {googleEnabled ? (
        <>
          <Link
            href={googleHref}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg', block: true }))}
          >
            <Chrome className="h-4 w-4" aria-hidden="true" />
            {t('auth.continueWithGoogle')}
          </Link>
          <p className="text-center text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('auth.orUseEmail')}
          </p>
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={t('auth.email')} htmlFor="email" error={errors.email} required>
          <Input
            {...fieldAria('email', errors.email)}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
          />
        </Field>

        <Field label={t('auth.password')} htmlFor="password" error={errors.password} required>
          <Input
            {...fieldAria('password', errors.password)}
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" size="lg" block loading={loading}>
          {t('auth.submitLogin')}
        </Button>

        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-primary underline underline-offset-4">
            {t('auth.forgotLink')}
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="text-primary underline underline-offset-4">
            {t('auth.submitRegister')}
          </Link>
        </p>
      </form>
    </div>
  );
}
