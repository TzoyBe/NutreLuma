import { ProfileTabs } from '@/components/profile-tabs';
import { getT } from '@/i18n/locale';
import { requirePageUser } from '@/server/auth/guards';

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const [t, user] = await Promise.all([getT(), requirePageUser()]);

  return (
    <>
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
        </div>
        <ProfileTabs isAdmin={user.role === 'ADMIN'} />
      </div>

      {children}
    </>
  );
}
