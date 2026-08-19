import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getUserTimezone } from '@/server/services/profile';
import { formatDateInTz } from '@/lib/dates';
import { AdminUserList } from '@/components/admin/user-list';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.usersTitle') };
}
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const t = await getT();
  const user = await requirePageUser();
  // notFound() αντί για 403: δεν αποκαλύπτουμε καν ότι υπάρχει σελίδα admin.
  if (user.role !== 'ADMIN') notFound();

  const [users, timezone] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        subscription: { select: { accessUntil: true } },
      },
    }),
    getUserTimezone(user.id),
  ]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('admin.usersTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.usersSubtitle')}</p>
        </div>
        <Link href="/admin/db" className="shrink-0 text-sm font-medium text-primary hover:underline">
          {t('admin.dbLink')}
        </Link>
      </div>

      <AdminUserList
        users={users.map((row) => ({
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          role: row.role,
          accessUntilLabel: row.subscription
            ? formatDateInTz(row.subscription.accessUntil, timezone)
            : null,
        }))}
      />
    </>
  );
}
