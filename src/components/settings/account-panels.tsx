'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, TriangleAlert } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { changePasswordSchema, deleteAccountSchema } from '@/lib/validation/auth';
import { updateAccountSchema } from '@/lib/validation/profile';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input } from '@/components/ui/field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

function collectIssues(error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  const next: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!next[key]) next[key] = issue.message;
  }
  return next;
}

export function AccountPanel({ email, displayName }: { email: string; displayName: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = React.useState(displayName);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setErrors({});
    const parsed = updateAccountSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      setErrors(collectIssues(parsed.error));
      return;
    }
    setSaving(true);
    try {
      await api.patch('/api/account', parsed.data);
      toast.push(t('settings.saved'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.account')}</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t('auth.displayName')} htmlFor="displayName" error={errors.displayName}>
            <Input
              {...fieldAria('displayName', errors.displayName)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordPanel() {
  const t = useT();
  const toast = useToast();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setErrors({});
    const form = new FormData(event.currentTarget);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword: String(form.get('newPassword') ?? ''),
      newPasswordConfirm: String(form.get('newPasswordConfirm') ?? ''),
    });
    if (!parsed.success) {
      setErrors(collectIssues(parsed.error));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/account/password', parsed.data);
      toast.push(t('settings.passwordChanged'), 'success');
      formRef.current?.reset();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors({ currentPassword: error.message });
        toast.push(error.message, 'error');
      } else {
        toast.push(t('errors.generic'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.changePassword')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
          <Field
            label={t('settings.currentPassword')}
            htmlFor="currentPassword"
            error={errors.currentPassword}
            required
          >
            <Input
              {...fieldAria('currentPassword', errors.currentPassword)}
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field
            label={t('settings.newPassword')}
            htmlFor="newPassword"
            error={errors.newPassword}
            hint={t('auth.passwordHint')}
            required
          >
            <Input
              {...fieldAria('newPassword', errors.newPassword)}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Field
            label={t('settings.newPasswordConfirm')}
            htmlFor="newPasswordConfirm"
            error={errors.newPasswordConfirm}
            required
          >
            <Input
              {...fieldAria('newPasswordConfirm', errors.newPasswordConfirm)}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DataPanel() {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.dataTitle')}</CardTitle>
        <CardDescription>{t('settings.exportHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <a
          href="/api/account/export?format=json"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
          download
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('settings.exportJson')}
        </a>
        <a
          href="/api/account/export?format=csv"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
          download
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('settings.exportCsv')}
        </a>
      </CardContent>
    </Card>
  );
}

export function DangerZonePanel() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  function validate() {
    const parsed = deleteAccountSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      setErrors(collectIssues(parsed.error));
      return false;
    }
    setErrors({});
    return true;
  }

  async function remove() {
    setDeleting(true);
    try {
      await api.delete('/api/account', { password, confirmation });
      router.replace('/');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          {t('settings.dangerZone')}
        </CardTitle>
        <CardDescription>{t('settings.deleteAccountBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={t('auth.password')} htmlFor="deletePassword" error={errors.password} required>
          <Input
            {...fieldAria('deletePassword', errors.password)}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field
          label={t('settings.deleteAccountConfirm')}
          htmlFor="confirmation"
          error={errors.confirmation}
          required
        >
          <Input
            {...fieldAria('confirmation', errors.confirmation)}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={t('settings.deleteAccountWord')}
          />
        </Field>
        <Button
          variant="destructive"
          onClick={() => {
            if (validate()) setOpen(true);
          }}
        >
          {t('settings.deleteAccount')}
        </Button>
      </CardContent>

      <ConfirmDialog
        open={open}
        title={t('settings.deleteAccount')}
        body={t('settings.deleteAccountBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </Card>
  );
}
