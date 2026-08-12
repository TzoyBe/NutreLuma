import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePageUser } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
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
import { JOYBEE, JoybeeAttribution } from '@/components/brand/joybee';
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
  const [profile, intelligenceSettings, googleIdentity] = await Promise.all([
    getProfile(user.id),
    getIntelligenceSettings(user.id),
    prisma.authIdentity.findFirst({
      where: { userId: user.id, provider: 'GOOGLE' },
      select: { id: true },
    }),
  ]);

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
        <CardHeader>
          <CardTitle>{t('app.aboutTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('app.aboutBody')}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <JoybeeAttribution prefix={t('app.partOf')} />
            <span className="text-xs text-muted-foreground">{JOYBEE.copyright}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <Link href="/terms" className="text-sm text-primary underline underline-offset-4">
              {t('terms.navLabel')}
            </Link>
            <Link href="/privacy" className="text-sm text-primary underline underline-offset-4">
              {t('nav.privacy')}
            </Link>
          </div>
        </CardContent>
      </Card>

      <DangerZonePanel passwordRequired={!googleIdentity} />

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
