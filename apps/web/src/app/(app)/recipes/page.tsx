import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getCurrentRecipePlan } from '@/server/services/recipe-plans';
import { listSavedRecipes } from '@/server/services/saved-recipes';
import { todayISO } from '@/lib/dates';
import { DailyPlanPanel } from '@/components/recipes/daily-plan-panel';
import { SavedRecipes } from '@/components/recipes/saved-recipes';
import { RecipesUniverse } from '@/components/recipes/recipes-universe';
import { buildRecipeUniverseModel } from '@/components/recipes/recipes-universe-model';
import { Card, CardContent } from '@/components/ui/card';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('recipes.navTitle') };
}

export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const date = todayISO(profile.timezone);
  const [plan, saved] = await Promise.all([
    getCurrentRecipePlan(user.id, date),
    listSavedRecipes(user.id),
  ]);

  const universeModel = buildRecipeUniverseModel({
    hasPlan: Boolean(plan),
    remainingCalories: plan?.remainingTarget.calories ?? 0,
    remainingProteinGrams: plan?.remainingTarget.proteinGrams ?? 0,
    remainingCarbohydrateGrams: plan?.remainingTarget.carbohydrateGrams ?? 0,
    remainingFatGrams: plan?.remainingTarget.fatGrams ?? 0,
    mealsPlanned: plan?.meals.length ?? 0,
    savedCount: saved.length,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('recipes.navTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('recipes.subtitle')}</p>
      </div>

      <RecipesUniverse
        model={universeModel}
        labels={{
          title: t('recipes.navTitle'),
          protein: t('recipes.protein'),
          carbohydrate: t('recipes.carbs'),
          fat: t('recipes.fat'),
        }}
      />

      <Card className="goals-journey-strip">
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="goals-journey-stat min-w-0">
            <p className="text-lg font-semibold tabular-nums">{universeModel.journey.mealsPlanned}</p>
            <p className="text-xs text-muted-foreground">{t('recipes.mealsPlannedToday')}</p>
          </div>
          <div className="goals-journey-stat min-w-0">
            <p className="text-lg font-semibold tabular-nums">{universeModel.journey.saved}</p>
            <p className="text-xs text-muted-foreground">{t('recipes.savedTitle')}</p>
          </div>
        </CardContent>
      </Card>

      <DailyPlanPanel date={date} />
      <SavedRecipes />
    </div>
  );
}
