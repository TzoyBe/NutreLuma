import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { ManualMealForm } from '@/components/meal/manual-meal-form';
import { Disclaimer } from '@/components/ui/misc';
import { utcToLocalDateTimeInput } from '@/lib/dates';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meal.manualTitle') };
}
export const dynamic = 'force-dynamic';

export default async function ManualMealPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t('common.back')}
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('meal.manualTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('meal.manualSubtitle')}</p>
      </div>

      <ManualMealForm
        defaultDateTime={utcToLocalDateTimeInput(new Date(), profile.timezone)}
      />

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
