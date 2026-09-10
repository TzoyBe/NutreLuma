import type { Metadata } from 'next';
import { RegisterForm } from '@/components/forms/register-form';
import { Disclaimer } from '@/components/ui/misc';
import { PersonalUniverseAuthShell } from '@/components/auth/personal-universe-auth-shell';
import { getT } from '@/i18n/locale';
import { googleAuthConfigured } from '@/server/env';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.registerTitle') };
}

export default async function RegisterPage() {
  const t = await getT();
  return (
    <PersonalUniverseAuthShell
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      backLabel="Back to home"
      partOfLabel={t('app.partOf')}
    >
      <div className="space-y-5">
        <RegisterForm googleEnabled={googleAuthConfigured} />
        <Disclaimer text={t('app.disclaimer')} />
      </div>
    </PersonalUniverseAuthShell>
  );
}
