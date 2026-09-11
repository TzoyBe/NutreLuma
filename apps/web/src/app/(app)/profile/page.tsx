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
import { buttonVariants } from '@/components/ui/button';
import { Disclaimer } from '@/components/ui/misc';
import { JOYBEE, JoybeeAttribution } from '@/components/brand/joybee';
import { cn } from '@/lib/utils';
import { getT } from '@/i18n/locale';
import { getIntelligenceSettings } from '@/server/services/personal-intelligence';
import { IntelligenceSettings } from '@/components/intelligence/intelligence-panel';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { ProfileUniverse } from '@/components/profile/profile-universe';
import { buildProfileUniverseModel } from '@/components/profile/profile-universe-model';
import { resolveAccessState, type AccessStateKind } from '@/lib/billing/access';
import type { TranslationKey } from '@/i18n';
import { env } from '@/server/env';
import { CreditCard } from 'lucide-react';

const STATUS_KEY: Record<AccessStateKind, TranslationKey> = {
  TRIAL: 'billing.statusTrial',
  ACTIVE: 'billing.statusActive',
  GRACE: 'billing.statusGrace',
  LOCKED: 'billing.statusLocked',
  UNLIMITED: 'billing.statusUnlimited',
};

function computeAge(birthDateISO: string): number | null {
  const d = new Date(birthDateISO);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function computeBmi(heightCm: number, weightKg: number): { value: number; label: string } | null {
  const h = heightCm / 100;
  if (!Number.isFinite(h) || !Number.isFinite(weightKg) || h <= 0 || weightKg <= 0) return null;
  const bmi = weightKg / (h * h);
  if (!Number.isFinite(bmi) || bmi < 8 || bmi > 90) return null;
  const label = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese';
  return { value: Math.round(bmi * 10) / 10, label };
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('profile.tabAccount') };
}
export const dynamic = 'force-dynamic';

export default async function ProfileAccountPage() {
  const t = await getT();
  const user = await requirePageUser();
  const [profile, intelligenceSettings, googleIdentity, subscription] = await Promise.all([
    getProfile(user.id),
    getIntelligenceSettings(user.id),
    prisma.authIdentity.findFirst({
      where: { userId: user.id, provider: 'GOOGLE' },
      select: { id: true },
    }),
    prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { status: true, provider: true, accessUntil: true, autoRenew: true },
    }),
  ]);

  const age = profile ? computeAge(profile.birthDate) : null;
  const bmi = profile ? computeBmi(profile.heightCm, profile.currentWeightKg) : null;
  const dailyTarget = profile?.effectiveDailyCalorieTarget ?? profile?.dailyCalorieTarget ?? null;
  const accessState = resolveAccessState({
    role: user.role,
    billingEnabled: env.BILLING_ENABLED,
    graceDays: env.SUBSCRIPTION_GRACE_DAYS,
    subscription,
  });
  const profileModel = buildProfileUniverseModel({
    displayName: user.displayName,
    email: user.email,
    dailyTarget,
    age,
    bmi,
    currentWeightKg: profile?.currentWeightKg,
    targetWeightKg: profile?.targetWeightKg,
    activityLevel: profile?.activityLevel,
    goal: profile?.goal,
    planStatus: t(STATUS_KEY[accessState.kind]),
  });

  const profileSummary = (
    <Card solid className="shadow-none">
      <CardHeader>
        <CardTitle>{t('settings.profile')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="profile-universe-summary grid gap-4 sm:grid-cols-2">
          {profileModel.healthSummary.map((item) => (
            <div key={item.key}>
              <dt className="text-xs text-muted-foreground">{t(`onboarding.${item.key}`)}</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {item.key === 'activityLevel' && profile
                  ? t(`activity.${profile.activityLevel}`)
                  : item.key === 'goal' && profile
                    ? t(`goal.${profile.goal}`)
                    : item.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );

  const profileEditor = (
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
  );

  const planTab = (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-base font-semibold">{t('profile.tabBilling')}</p>
          <p className="text-sm text-muted-foreground">{t('billing.subtitle')}</p>
        </div>
        <Link
          href="/billing"
          className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'shrink-0')}
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          {t('common.open')}
        </Link>
      </CardContent>
    </Card>
  );

  const accountTab = (
    <>
      <AccountPanel email={user.email} displayName={user.displayName} />
      <PasswordPanel />
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
    </>
  );

  return (
    <>
      <ProfileUniverse
        model={profileModel}
        labels={{
          title: t('profile.title'),
          dailyTarget: t('onboarding.dailyCalorieTarget'),
          planStatus: t('profile.tabPlan'),
          age: 'Age',
          bmi: 'BMI',
        }}
      />
      <ProfileTabs
        profileSummary={profileSummary}
        profileEditor={profileEditor}
        coaching={<IntelligenceSettings initial={intelligenceSettings} />}
        plan={planTab}
        account={accountTab}
      />

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
