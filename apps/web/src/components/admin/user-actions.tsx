'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';

type PendingAction = 'lock' | 'unlock' | 'expire' | 'soft-delete' | null;

export function AdminUserActions({
  userId,
  userEmail,
  locked,
  deleted,
}: {
  userId: string;
  userEmail: string;
  locked: boolean;
  deleted: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [confirming, setConfirming] = React.useState<PendingAction>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = React.useState('');
  const [hardDeleting, setHardDeleting] = React.useState(false);

  async function run(action: Exclude<PendingAction, null>, path: string) {
    setPending(action);
    try {
      await api.post(`/api/admin/users/${userId}/${path}`);
      toast.push('Done.', 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : 'Something went wrong.', 'error');
    } finally {
      setPending(null);
      setConfirming(null);
    }
  }

  async function hardDelete() {
    setHardDeleting(true);
    try {
      await api.post(`/api/admin/users/${userId}/hard-delete`, { confirmEmail: hardDeleteConfirm });
      toast.push('User permanently deleted.', 'success');
      router.push('/admin/users');
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : 'Something went wrong.', 'error');
    } finally {
      setHardDeleting(false);
    }
  }

  if (deleted) {
    return <p className="text-sm text-muted-foreground">This account is soft-deleted. No further actions available.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {locked ? (
          <Button variant="outline" onClick={() => void run('unlock', 'unlock')} loading={pending === 'unlock'} disabled={pending !== null}>
            Unlock account
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setConfirming('lock')} disabled={pending !== null}>
            Lock account
          </Button>
        )}
        <Button variant="outline" onClick={() => setConfirming('expire')} disabled={pending !== null}>
          Expire access
        </Button>
        <Button variant="outline" onClick={() => setConfirming('soft-delete')} disabled={pending !== null}>
          Soft delete
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <p className="text-sm font-medium text-destructive">Permanent deletion (GDPR request)</p>
        <p className="text-xs text-muted-foreground">
          Type the account email ({userEmail}) to confirm. This permanently deletes all data for this user and
          cannot be undone.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={hardDeleteConfirm}
            onChange={(e) => setHardDeleteConfirm(e.target.value)}
            placeholder={userEmail}
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            disabled={hardDeleteConfirm.trim().toLowerCase() !== userEmail.toLowerCase() || hardDeleting}
            loading={hardDeleting}
            onClick={() => void hardDelete()}
          >
            Permanently delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming === 'lock'}
        title="Lock this account?"
        body="The user will be signed out and unable to log in until you unlock the account."
        confirmLabel="Lock account"
        destructive
        loading={pending === 'lock'}
        onConfirm={() => void run('lock', 'lock')}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'expire'}
        title="Expire this account's access?"
        body="Ends the current subscription immediately. The user can still log in and re-subscribe."
        confirmLabel="Expire access"
        destructive
        loading={pending === 'expire'}
        onConfirm={() => void run('expire', 'expire')}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'soft-delete'}
        title="Soft-delete this account?"
        body="Blocks login and hides the account, but keeps all data and audit history."
        confirmLabel="Soft delete"
        destructive
        loading={pending === 'soft-delete'}
        onConfirm={() => void run('soft-delete', 'soft-delete')}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
