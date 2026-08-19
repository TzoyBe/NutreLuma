import { requirePageUser } from '@/server/auth/guards';
import { AppNav } from '@/components/app-nav';
import { UnlockCelebrationProvider } from '@/components/goals/unlock-celebration-provider';
import { SiteFooter } from '@/components/site-footer';
import { getT } from '@/i18n/locale';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([requirePageUser(), getT()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <UnlockCelebrationProvider>
        <AppNav displayName={user.displayName} />
        <main id="main" className="container max-w-6xl flex-1 space-y-5 py-5">
          {children}
        </main>
        <div className="pb-28 md:pb-6">
          <SiteFooter labels={{ partOf: t('app.partOf'), productOf: t('app.productOf') }} />
        </div>
      </UnlockCelebrationProvider>
    </div>
  );
}
