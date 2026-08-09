import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { evaluateGoalsForUser } from '@/server/services/goals-evaluator';
import { listMilestones, suggestMilestones } from '@/server/services/milestones';
import { listBadges, upsertBadgeCatalog } from '@/server/services/badges';
import { listNotifications } from '@/server/services/notifications';
import { todayISO } from '@/lib/dates';
import { AchievementsPanel } from '@/components/goals/achievements-panel';
import { Disclaimer } from '@/components/ui/misc';
import { getT } from '@/i18n/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('goals.achievementsTitle') };
}

export default async function GoalsAchievementsPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const today = todayISO(profile.timezone);
  await upsertBadgeCatalog();
  const [evaluation, milestones, badges, notifications, suggestions] = await Promise.all([
    evaluateGoalsForUser(user.id),
    listMilestones(user.id, { limit: 20 }),
    listBadges(user.id),
    listNotifications(user.id, { limit: 20 }),
    suggestMilestones(user.id, today),
  ]);

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('goals.achievementsTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('goals.achievementsSubtitle')}</p>
      </div>

      <AchievementsPanel
        milestones={milestones}
        achievements={evaluation.achievements}
        badges={badges}
        notifications={notifications}
        suggestions={suggestions}
        today={today}
      />

      <Disclaimer text={t('goals.progressDisclaimer')} />
    </>
  );
}
