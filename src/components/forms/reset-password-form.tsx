'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input } from '@/components/ui/field';
import { useT } from '@/i18n/client';

export function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = React.useState('');
  const [passwordConfirm, setPasswordConfirm] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrors({});

    try {
      await api.post('/api/auth/reset-password', { token, password, passwordConfirm });
      setDone(true);
      // Ο χρήστης συνδέεται ρητά με τον νέο κωδικό — δεν τον συνδέουμε αυτόματα.
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const fieldErrors = error.fieldErrors();
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: error.message });
      } else {
        setErrors({ form: t('errors.generic') });
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">{t('auth.resetMissingToken')}</p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-primary underline underline-offset-4"
        >
          {t('auth.forgotTitle')}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium">{t('auth.resetDoneTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('auth.resetDoneBody')}</p>
        </div>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 font-medium text-primary-foreground"
        >
          {t('auth.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('auth.resetSubtitle')}</p>

      <Field label={t('auth.newPassword')} htmlFor="password" error={errors.password}>
        <Input
          {...fieldAria('password', errors.password)}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>

      <Field
        label={t('auth.passwordConfirm')}
        htmlFor="passwordConfirm"
        error={errors.passwordConfirm}
      >
        <Input
          {...fieldAria('passwordConfirm', errors.passwordConfirm)}
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
        />
      </Field>

      {errors.token ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errors.token}
        </p>
      ) : null}
      {errors.form ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" loading={loading} block>
        {t('auth.resetSubmit')}
      </Button>
    </form>
  );
}
