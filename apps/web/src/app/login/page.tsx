import type { Metadata } from 'next';
import { LoginForm } from '@/components/forms/login-form';
import { PersonalUniverseAuthShell } from '@/components/auth/personal-universe-auth-shell';
import { getT } from '@/i18n/locale';
import { googleAuthConfigured } from '@/server/env';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.loginTitle') };
}

function oauthErrorMessage(
  code: string | undefined,
  t: (key: 'auth.googleUnavailable' | 'auth.googleFailed' | 'auth.googleAccessDenied') => string,
) {
  if (!code) return undefined;
  if (code === 'access_denied') return t('auth.googleAccessDenied');
  if (code === 'google_unavailable') return t('auth.googleUnavailable');
  return t('auth.googleFailed');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauthError?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;

  return (
    <PersonalUniverseAuthShell
      title={t('auth.loginTitle')}
      subtitle="Continue your journey with a clearer view of your nutrition."
      backLabel="Back to home"
      partOfLabel={t('app.partOf')}
    >
      <LoginForm
        nextPath={params.next}
        googleEnabled={googleAuthConfigured}
        initialError={oauthErrorMessage(params.oauthError, t)}
      />
    </PersonalUniverseAuthShell>
  );
}
