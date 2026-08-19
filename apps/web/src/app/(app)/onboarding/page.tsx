import type { Metadata } from 'next';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { ProfileForm } from '@/components/forms/profile-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('onboarding.title') };
}
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('onboarding.title')}</CardTitle>
        <CardDescription>{t('onboarding.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm
          redirectTo="/welcome"
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
  );
}
