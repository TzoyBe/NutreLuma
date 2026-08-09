import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { ProfileForm } from '@/components/forms/profile-form';
import {
  AccountPanel,
  DangerZonePanel,
  DataPanel,
  PasswordPanel,
} from '@/components/settings/account-panels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Disclaimer } from '@/components/ui/misc';
import { getT } from '@/i18n/locale';
import { getIntelligenceSettings } from '@/server/services/personal-intelligence';
import { IntelligenceSettings } from '@/components/intelligence/intelligence-panel';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('profile.tabAccount') };
}
export const dynamic = 'force-dynamic';

export default async function ProfileAccountPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  const intelligenceSettings = await getIntelligenceSettings(user.id);

  return (
    <>
      <AccountPanel email={user.email} displayName={user.displayName} />

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            submitLabel={t('common.save')}
            initial={
              profile
                ? {
                    firstName: profile.firstName,
                    lastName: profile.lastName ?? '',
                    birthDate: profile.birthDate,
                    gender: profile.gender,
                    heightCm: String(profile.heightCm),
                    currentWeightKg: String(profile.currentWeightKg),
                    targetWeightKg: profile.targetWeightKg ? String(profile.targetWeightKg) : '',
                    activityLevel: profile.activityLevel,
                    goal: profile.goal,
                    dailyCalorieTarget: profile.dailyCalorieTarget
                      ? String(profile.dailyCalorieTarget)
                      : '',
                    preferredUnits: profile.preferredUnits,
                    timezone: profile.timezone,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <PasswordPanel />
      <IntelligenceSettings initial={intelligenceSettings} />
      <DataPanel />

      {user.role === 'ADMIN' ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.section')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/admin/users" className="text-sm text-primary underline underline-offset-4">
              {t('admin.usersTitle')}
            </Link>
            <Link href="/admin/db" className="text-sm text-primary underline underline-offset-4">
              {t('admin.dbLink')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="text-sm text-primary underline underline-offset-4">
            {t('terms.navLabel')}
          </Link>
          <Link href="/privacy" className="text-sm text-primary underline underline-offset-4">
            {t('nav.privacy')}
          </Link>
        </CardContent>
      </Card>

      <DangerZonePanel />

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
