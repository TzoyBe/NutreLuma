import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Scale, Trophy } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { getGoalForDay, listGoalHistory, suggestGoals } from '@/server/services/goals';
import { GoalsPanel } from '@/components/goals/goals-panel';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Disclaimer } from '@/components/ui/misc';
import { todayISO } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('goals.title') };
}
export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const today = todayISO(profile.timezone);
  const [goal, suggestion, history] = await Promise.all([
    getGoalForDay(user.id, today),
    suggestGoals(user.id),
    listGoalHistory(user.id),
  ]);

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('goals.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('goals.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-base font-semibold">{t('goals.achievementsTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('goals.achievementsSubtitle')}</p>
          </div>
          <Link
            href="/goals/achievements"
            className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'shrink-0')}
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            {t('goals.openAchievements')}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-base font-semibold">{t('maintenance.lockedTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('maintenance.lockedBody')}</p>
          </div>
          <Link
            href="/maintenance"
            className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'shrink-0')}
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            {t('common.open')}
          </Link>
        </CardContent>
      </Card>

      <GoalsPanel
        goal={{
          calorieTarget: goal.calorieTarget,
          proteinGrams: goal.proteinGrams,
          carbohydrateGrams: goal.carbohydrateGrams,
          fatGrams: goal.fatGrams,
          fiberGrams: goal.fiberGrams,
          waterMl: goal.waterMl,
          stepsTarget: goal.stepsTarget,
        }}
        suggestion={suggestion}
        history={history.map((row) => ({
          id: row.id,
          effectiveFrom: row.effectiveFrom,
          source: row.source,
          calorieTarget: row.calorieTarget,
          proteinGrams: row.proteinGrams,
          carbohydrateGrams: row.carbohydrateGrams,
          fatGrams: row.fatGrams,
        }))}
      />

      <Disclaimer text={t('app.disclaimer')} />
    </>
  );
}
