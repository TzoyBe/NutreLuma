import 'server-only';
import { logger } from '../logger';
import { evaluateAchievementsForUser } from './achievements';
import { recomputeActiveMilestonesForUser } from './milestone-progress';
import { evaluateMaintenanceForUser } from './maintenance';

export interface GoalsEvaluationResult {
  milestonesEvaluated: number;
  achievements: Awaited<ReturnType<typeof evaluateAchievementsForUser>>;
}

export async function evaluateGoalsForUser(userId: string): Promise<GoalsEvaluationResult> {
  const progress = await recomputeActiveMilestonesForUser(userId);
  const achievements = await evaluateAchievementsForUser(userId);
  // Συντήρηση: επαναϋπολογισμός κατάστασης + idempotent alerts (no-op αν ανενεργό).
  await evaluateMaintenanceForUser(userId);
  return { milestonesEvaluated: progress.length, achievements };
}

export function evaluateGoalsForUserBestEffort(userId: string): void {
  void evaluateGoalsForUser(userId).catch((error) => {
    logger.error('goals_evaluation_failed', {
      userId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });
}
