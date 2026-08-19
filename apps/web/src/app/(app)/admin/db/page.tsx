import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getT } from '@/i18n/locale';
import { AdminDbBrowser } from '@/components/admin/db-browser';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('admin.dbTitle') };
}

export const dynamic = 'force-dynamic';

export default async function AdminDbPage() {
  const user = await requirePageUser();
  // notFound() αντί για 403: δεν αποκαλύπτουμε καν ότι υπάρχει σελίδα admin.
  if (user.role !== 'ADMIN') notFound();

  return <AdminDbBrowser />;
}
