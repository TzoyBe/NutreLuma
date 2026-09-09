import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getUserTimezone } from '@/server/services/profile';
import { formatDateInTz, formatTimeInTz } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminUserActions } from '@/components/admin/user-actions';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.userDetailTitle') };
}
export const dynamic = 'force-dynamic';

const AUDIT_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  PASSWORD_CHANGE: 'Password changed',
  ACCOUNT_LOCKED: 'Account locked',
  ACCOUNT_UNLOCKED: 'Account unlocked',
  ACCESS_EXPIRED: 'Access expired (admin)',
  ACCOUNT_SOFT_DELETED: 'Account soft-deleted',
  ACCOUNT_HARD_DELETED: 'Account hard-deleted',
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const admin = await requirePageUser();
  if (admin.role !== 'ADMIN') notFound();

  const [user, auditLogs, timezone] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
        passwordChangedAt: true,
        lockedAt: true,
        lockReason: true,
        deletedAt: true,
        subscription: true,
        payments: { orderBy: { paidAt: 'desc' }, take: 20 },
      },
    }),
    prisma.auditLog.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    getUserTimezone(admin.id),
  ]);

  if (!user) notFound();

  const fmt = (date: Date) => `${formatDateInTz(date, timezone)} ${formatTimeInTz(date, timezone)}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{user.displayName}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Link href="/admin/users" className="shrink-0 text-sm font-medium text-primary hover:underline">
          {t('admin.backToUsers')}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.accountStatus')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Role: </span>
              {user.role}
            </p>
            <p>
              <span className="text-muted-foreground">Created: </span>
              {fmt(user.createdAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Password changed: </span>
              {user.passwordChangedAt ? fmt(user.passwordChangedAt) : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Status: </span>
              {user.deletedAt
                ? `Soft-deleted (${fmt(user.deletedAt)})`
                : user.lockedAt
                  ? `Locked (${fmt(user.lockedAt)})${user.lockReason ? ` — ${user.lockReason}` : ''}`
                  : 'Active'}
            </p>
          </div>
          <AdminUserActions
            userId={user.id}
            userEmail={user.email}
            locked={Boolean(user.lockedAt)}
            deleted={Boolean(user.deletedAt)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.subscription')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {user.subscription ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Status: </span>
                {user.subscription.status}
              </p>
              <p>
                <span className="text-muted-foreground">Provider: </span>
                {user.subscription.provider ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Access until: </span>
                {fmt(user.subscription.accessUntil)}
              </p>
              <p>
                <span className="text-muted-foreground">Auto-renew: </span>
                {user.subscription.autoRenew ? 'Yes' : 'No'}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No subscription record.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.payments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {user.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {user.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span>{fmt(payment.paidAt)}</span>
                  <span className="text-muted-foreground">{payment.provider}</span>
                  <span className="font-medium tabular-nums">
                    {(payment.amountCents / 100).toFixed(2)} {payment.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.auditLog')}</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded events.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {auditLogs.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span>{fmt(entry.createdAt)}</span>
                  <span className="font-medium">{AUDIT_LABELS[entry.type] ?? entry.type}</span>
                  {entry.metadata ? (
                    <span className="text-xs text-muted-foreground">{JSON.stringify(entry.metadata)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
