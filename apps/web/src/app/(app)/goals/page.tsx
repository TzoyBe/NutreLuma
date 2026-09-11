import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Scale, Trophy } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import {
  countGoalHistory,
  getGoalForDay,
  listGoalHistory,
  suggestGoals,
} from '@/server/services/goals';
import { listAchievements } from '@/server/services/achievements';
import { listBadges } from '@/server/services/badges';
import { countActiveMilestones } from '@/server/services/milestones';
import { GoalsPanel } from '@/components/goals/goals-panel';
import { GoalsUniverse } from '@/components/goals/goals-universe';
import { buildGoalUniverseModel } from '@/components/goals/goals-universe-model';
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
  const [goal, suggestion, history, achievements, badges, activeMilestoneCount, historyCount] =
    await Promise.all([
      getGoalForDay(user.id, today),
      suggestGoals(user.id),
      listGoalHistory(user.id),
      listAchievements(user.id),
      listBadges(user.id),
      countActiveMilestones(user.id),
      countGoalHistory(user.id),
    ]);

  const universeModel = buildGoalUniverseModel({
    calorieTarget: goal.calorieTarget,
    proteinGrams: goal.proteinGrams,
    carbohydrateGrams: goal.carbohydrateGrams,
    fatGrams: goal.fatGrams,
    achievementsUnlocked: achievements.filter((achievement) => achievement.unlocked).length,
    achievementsTotal: achievements.length,
    badgesUnlocked: badges.filter((badge) => badge.unlocked).length,
    activeMilestones: activeMilestoneCount,
    historyCount,
  });

  const journeyStats = [
    { label: t('achievements.achievements'), value: universeModel.journey.achievements },
    { label: t('achievements.badges'), value: universeModel.journey.badges },
    { label: t('achievements.activeGoals'), value: universeModel.journey.activeMilestones },
    { label: t('goals.history'), value: universeModel.journey.history },
  ];

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('goals.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('goals.subtitle')}</p>
      </div>

      <GoalsUniverse
        model={universeModel}
        labels={{
          title: t('goals.title'),
          protein: t('goals.protein'),
          carbohydrate: t('goals.carbohydrate'),
          fat: t('goals.fat'),
        }}
      />

      <Card className="goals-journey-strip">
        <CardContent className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
            {journeyStats.map((stat) => (
              <div key={stat.label} className="goals-journey-stat min-w-0">
                <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/goals/achievements"
              className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'shrink-0')}
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {t('goals.openAchievements')}
            </Link>
            <Link
              href="/maintenance"
              className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'shrink-0')}
            >
              <Scale className="h-4 w-4" aria-hidden="true" />
              {t('common.open')}
              <span className="sr-only"> {t('maintenance.lockedTitle')}</span>
            </Link>
          </div>
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
