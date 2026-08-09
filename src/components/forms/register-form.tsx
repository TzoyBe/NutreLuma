'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { registerSchema } from '@/lib/validation/auth';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

type Errors = Record<string, string>;

export function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = React.useState<Errors>({});
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return; // αποτροπή διπλής υποβολής
    setErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      email: String(form.get('email') ?? ''),
      displayName: String(form.get('displayName') ?? ''),
      password: String(form.get('password') ?? ''),
      passwordConfirm: String(form.get('passwordConfirm') ?? ''),
      consent: form.get('consent') === 'on',
    });

    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/register', parsed.data);
      router.replace('/onboarding');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const fieldErrors = error.fieldErrors();
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setErrors({ email: error.message });
        toast.push(error.message, 'error');
      } else {
        toast.push(t('errors.generic'), 'error');
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label={t('auth.displayName')} htmlFor="displayName" error={errors.displayName} required>
        <Input {...fieldAria('displayName', errors.displayName)} autoComplete="nickname" required />
      </Field>

      <Field label={t('auth.email')} htmlFor="email" error={errors.email} required>
        <Input
          {...fieldAria('email', errors.email)}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
        />
      </Field>

      <Field
        label={t('auth.password')}
        htmlFor="password"
        error={errors.password}
        hint={t('auth.passwordHint')}
        required
      >
        <Input
          {...fieldAria('password', errors.password)}
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        label={t('auth.passwordConfirm')}
        htmlFor="passwordConfirm"
        error={errors.passwordConfirm}
        required
      >
        <Input
          {...fieldAria('passwordConfirm', errors.passwordConfirm)}
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <div className="space-y-1.5">
        <label htmlFor="consent" className="flex items-start gap-3 text-sm">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input"
            aria-describedby={errors.consent ? 'consent-error' : undefined}
          />
          <span className="text-muted-foreground">
            {t('auth.consent')}{' '}
            <Link href="/terms" className="text-primary underline underline-offset-4">
              {t('terms.navLabel')}
            </Link>{' '}
            &{' '}
            <Link href="/privacy" className="text-primary underline underline-offset-4">
              {t('nav.privacy')}
            </Link>
          </span>
        </label>
        {errors.consent ? (
          <p id="consent-error" role="alert" className="text-xs font-medium text-destructive">
            {errors.consent}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" block loading={loading}>
        {t('auth.submitRegister')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="text-primary underline underline-offset-4">
          {t('auth.submitLogin')}
        </Link>
      </p>
    </form>
  );
}
