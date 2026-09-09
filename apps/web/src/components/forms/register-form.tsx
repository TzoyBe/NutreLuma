'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Chrome } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { registerFieldsSchema, registerSchema, passwordStrength } from '@/lib/validation/auth';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, fieldAria, Input, PasswordInput } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';

type Errors = Record<string, string>;
type FieldName = keyof typeof registerFieldsSchema.shape;

export function RegisterForm({ googleEnabled }: { googleEnabled?: boolean }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = React.useState<Errors>({});
  const [loading, setLoading] = React.useState(false);
  const [isCapacitorApp, setIsCapacitorApp] = React.useState(false);
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    const maybeCapacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    setIsCapacitorApp(Boolean(maybeCapacitor?.isNativePlatform?.()));
  }, []);

  const googleHref = isCapacitorApp ? '/api/auth/google?app=capacitor' : '/api/auth/google';
  const strength = passwordStrength(password);

  function onFieldBlur(field: FieldName) {
    return (event: React.FocusEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      if (!value) return;
      const result = registerFieldsSchema.shape[field].safeParse(value);
      setErrors((prev) => {
        const next = { ...prev };
        if (!result.success) next[field] = result.error.issues[0]?.message ?? '';
        else delete next[field];
        return next;
      });
    };
  }

  function onPasswordConfirmBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setErrors((prev) => {
      const next = { ...prev };
      if (!value) delete next.passwordConfirm;
      else if (value !== password) next.passwordConfirm = 'Οι κωδικοί δεν ταιριάζουν.';
      else delete next.passwordConfirm;
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
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
      router.replace(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
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
    <div className="space-y-4">
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
        <Field label={t('auth.displayName')} htmlFor="displayName" error={errors.displayName} required>
          <Input
            {...fieldAria('displayName', errors.displayName)}
            autoComplete="nickname"
            onBlur={onFieldBlur('displayName')}
            required
          />
        </Field>

        <Field label={t('auth.email')} htmlFor="email" error={errors.email} required>
          <Input
            {...fieldAria('email', errors.email)}
            type="email"
            inputMode="email"
            autoComplete="email"
            onBlur={onFieldBlur('email')}
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
          <PasswordInput
            {...fieldAria('password', errors.password)}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={onFieldBlur('password')}
            required
          />
        </Field>
        {password ? (
          <p
            className={cn(
              '-mt-2 text-xs font-medium',
              strength.score <= 1 && 'text-destructive',
              strength.score === 2 && 'text-amber-500',
              strength.score === 3 && 'text-emerald-500',
            )}
          >
            {strength.label}
          </p>
        ) : null}

        <Field
          label={t('auth.passwordConfirm')}
          htmlFor="passwordConfirm"
          error={errors.passwordConfirm}
          required
        >
          <PasswordInput
            {...fieldAria('passwordConfirm', errors.passwordConfirm)}
            autoComplete="new-password"
            onBlur={onPasswordConfirmBlur}
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
    </div>
  );
}
