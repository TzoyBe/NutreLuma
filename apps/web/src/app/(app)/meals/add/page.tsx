import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile, getUserTimezone } from '@/server/services/profile';
import { getFavorites, getFrequentMeals, getRecentMeals } from '@/server/services/meal-history';
import { AddMealHero } from '@/components/meal/add-meal-hero';
import { QuickPickSection } from '@/components/meal/quick-pick-section';
import { HistorySearch } from '@/components/meal/history-search';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('addMeal.title') };
}
export const dynamic = 'force-dynamic';

export default async function AddMealPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');
  const timezone = await getUserTimezone(user.id);
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(now),
  );

  const [favorites, frequent, recent] = await Promise.all([
    getFavorites(user.id),
    getFrequentMeals(user.id, { now, hour }),
    getRecentMeals(user.id),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t('common.back')}
      </Link>
      <h1 className="sr-only">{t('addMeal.title')}</h1>

      <AddMealHero
        title={t('addMeal.heroTitle')}
        subtitle={t('addMeal.heroSubtitle')}
        manualLabel={t('addMeal.manualOption')}
      />

      <QuickPickSection favorites={favorites} frequent={[]} recent={[]} mode="favorites" />

      <HistorySearch />

      <QuickPickSection favorites={[]} frequent={frequent} recent={recent} mode="history" />
    </div>
  );
}
