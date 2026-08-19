import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Camera, PencilLine, ChevronLeft } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile, getUserTimezone } from '@/server/services/profile';
import { getFavorites, getFrequentMeals, getRecentMeals } from '@/server/services/meal-history';
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
      <h1 className="text-xl font-semibold tracking-tight">{t('addMeal.title')}</h1>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/meals/new"
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          <Camera className="h-5 w-5" aria-hidden="true" /> {t('addMeal.photoOption')}
        </Link>
        <Link
          href="/meals/manual"
          className="flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card font-semibold"
        >
          <PencilLine className="h-5 w-5" aria-hidden="true" /> {t('addMeal.manualOption')}
        </Link>
      </div>

      <QuickPickSection favorites={favorites} frequent={[]} recent={[]} mode="favorites" />

      <HistorySearch />

      <QuickPickSection favorites={[]} frequent={frequent} recent={recent} mode="history" />
    </div>
  );
}
