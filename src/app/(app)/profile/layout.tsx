import { ProfileTabs } from '@/components/profile-tabs';
import { getT } from '@/i18n/locale';

/**
 * Κοινό κέλυφος για τις σελίδες του προφίλ: λογαριασμός, βάρος, συνδρομή.
 * Ο τίτλος και οι καρτέλες μένουν σταθερά — αλλάζει μόνο το περιεχόμενο.
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();

  return (
    <>
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold">{t('profile.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('profile.subtitle')}</p>
        </div>
        <ProfileTabs />
      </div>

      {children}
    </>
  );
}
