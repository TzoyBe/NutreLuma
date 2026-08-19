'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  accessUntilLabel: string | null;
}

export function AdminUserList({ users }: { users: AdminUserRow[] }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [months, setMonths] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  async function extend(userId: string) {
    setPending(userId);
    try {
      await api.post('/api/admin/subscriptions/extend', {
        userId,
        months: Number(months[userId] ?? '1'),
        note: notes[userId] ?? '',
      });
      toast.push(t('admin.extended'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="space-y-3">
      {users.map((user) => (
        <li key={user.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{user.displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
            <p className="text-sm">
              {user.accessUntilLabel
                ? `${t('admin.accessUntil')} ${user.accessUntilLabel}`
                : t('admin.noAccess')}
            </p>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[6rem,1fr,auto]">
            <Input
              type="number"
              min={1}
              max={24}
              value={months[user.id] ?? '1'}
              onChange={(e) => setMonths((m) => ({ ...m, [user.id]: e.target.value }))}
              aria-label={t('admin.months')}
            />
            <Input
              value={notes[user.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [user.id]: e.target.value }))}
              placeholder={t('admin.note')}
              maxLength={300}
              aria-label={t('admin.note')}
            />
            <Button
              onClick={() => extend(user.id)}
              loading={pending === user.id}
              disabled={pending !== null}
            >
              {t('admin.extend')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
