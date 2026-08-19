import { notFound } from 'next/navigation';
import { ProfileTabs } from '@/components/profile-tabs';
import { getT } from '@/i18n/locale';
import { requirePageUser } from '@/server/auth/guards';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [t, user] = await Promise.all([getT(), requirePageUser()]);
  if (user.role !== 'ADMIN') notFound();

  return (
    <>
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
        </div>
        <ProfileTabs isAdmin />
      </div>

      {children}
    </>
  );
}
