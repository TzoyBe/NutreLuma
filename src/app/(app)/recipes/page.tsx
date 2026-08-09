import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { todayISO } from '@/lib/dates';
import { DailyPlanPanel } from '@/components/recipes/daily-plan-panel';
import { SavedRecipes } from '@/components/recipes/saved-recipes';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('recipes.navTitle') };
}

export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  return (
    <div className="flex flex-col gap-8">
      <DailyPlanPanel date={todayISO(profile.timezone)} />
      <SavedRecipes />
    </div>
  );
}
