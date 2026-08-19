'use client';

import * as React from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input } from '@/components/ui/field';
import { useT } from '@/i18n/client';

export function ResendVerificationForm({ initialEmail = '' }: { initialEmail?: string }) {
  const t = useT();
  const [email, setEmail] = React.useState(initialEmail);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrors({});

    try {
      await api.post('/api/auth/verify-email/resend', { email });
      setSent(true);
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

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium">Check your email</p>
          <p className="text-sm text-muted-foreground">
            If that account still needs verification, a new link is on its way.
          </p>
        </div>
        <Link href="/login" className="inline-block text-sm text-primary underline underline-offset-4">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter your email and we will send a fresh verification link.
      </p>

      <Field label={t('auth.email')} htmlFor="email" error={errors.email}>
        <Input
          {...fieldAria('email', errors.email)}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      {errors.form ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" loading={loading} block>
        Resend verification email
      </Button>

      <p className="text-center text-sm">
        <Link href="/login" className="text-primary underline underline-offset-4">
          Back to login
        </Link>
      </p>
    </form>
  );
}
