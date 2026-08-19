import 'server-only';
import { type Goal, type GoalMode } from '@prisma/client';
import { prisma } from '../db/prisma';
import { getUserTimezone } from './profile';
import { todayISO } from '@/lib/dates';

/**
 * Το ενεργό goal mode είναι source of truth στο `UserGoalMode`. Το παλιό
 * `HealthProfile.goal` (LOSE/MAINTAIN/GAIN) μένει συγχρονισμένο για συμβατότητα
 * με κώδικα που δεν έχει μεταφερθεί στο νέο mode.
 */

const MODE_TO_GOAL: Record<GoalMode, Goal> = {
  LOSS: 'LOSE',
  MAINTENANCE: 'MAINTAIN',
  GAIN: 'GAIN',
};
const GOAL_TO_MODE: Record<Goal, GoalMode> = {
  LOSE: 'LOSS',
  MAINTAIN: 'MAINTENANCE',
  GAIN: 'GAIN',
};

export interface GoalModeView {
  mode: GoalMode;
  activatedAt: string | null;
}

/**
 * Ενεργό mode. Αν δεν υπάρχει ακόμη εγγραφή `UserGoalMode`, παράγεται από το
 * υπάρχον `HealthProfile.goal` ώστε παλιοί λογαριασμοί να έχουν λογικό default.
 */
export async function getActiveGoalMode(userId: string): Promise<GoalModeView> {
  const row = await prisma.userGoalMode.findUnique({ where: { userId } });
  if (row) return { mode: row.mode, activatedAt: row.activatedAt.toISOString() };

  const profile = await prisma.healthProfile.findUnique({
    where: { userId },
    select: { goal: true },
  });
  return { mode: profile ? GOAL_TO_MODE[profile.goal] : 'LOSS', activatedAt: null };
}

export interface SetGoalModeOptions {
  reason?: string;
  targetWeightKg?: number | null;
  calorieTarget?: number | null;
}

/**
 * Αλλάζει το ενεργό mode (ποτέ αυτόματα — πάντα από ρητή ενέργεια χρήστη).
 * Κλείνει το προηγούμενο `GoalModeHistory` (endDate = σήμερα), ανοίγει νέο,
 * ενημερώνει `UserGoalMode` και συγχρονίζει το `HealthProfile.goal`.
 */
export async function setGoalMode(
  userId: string,
  mode: GoalMode,
  options: SetGoalModeOptions = {},
): Promise<GoalModeView> {
  const timezone = await getUserTimezone(userId);
  const today = todayISO(timezone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);

  const activatedAt = await prisma.$transaction(async (tx) => {
    // Κλείσε την ανοιχτή περίοδο ιστορικού (αν υπάρχει).
    await tx.goalModeHistory.updateMany({
      where: { userId, endDate: null },
      data: { endDate: todayDate },
    });

    await tx.goalModeHistory.create({
      data: {
        userId,
        mode,
        startDate: todayDate,
        targetWeightKg:
          options.targetWeightKg === undefined || options.targetWeightKg === null
            ? null
            : options.targetWeightKg,
        calorieTarget: options.calorieTarget ?? null,
        reason: options.reason ?? null,
      },
    });

    const saved = await tx.userGoalMode.upsert({
      where: { userId },
      create: { userId, mode },
      update: { mode },
    });

    // Κράτα το παλιό enum συγχρονισμένο.
    await tx.healthProfile.updateMany({
      where: { userId },
      data: { goal: MODE_TO_GOAL[mode] },
    });

    return saved.activatedAt;
  });

  return { mode, activatedAt: activatedAt.toISOString() };
}

export interface GoalModeHistoryEntry {
  id: string;
  mode: GoalMode;
  startDate: string;
  endDate: string | null;
  targetWeightKg: number | null;
  calorieTarget: number | null;
  reason: string | null;
}

export async function listModeHistory(
  userId: string,
  limit = 50,
): Promise<GoalModeHistoryEntry[]> {
  const rows = await prisma.goalModeHistory.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
    targetWeightKg: row.targetWeightKg === null ? null : Number(row.targetWeightKg),
    calorieTarget: row.calorieTarget,
    reason: row.reason,
  }));
}
