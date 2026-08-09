import { beforeEach, describe, expect, it, vi } from 'vitest';

const recomputeActiveMilestonesForUser = vi.fn(async () => [{ milestoneId: 'm1' }]);
const evaluateAchievementsForUser = vi.fn(async () => [{ code: 'FIRST_MEAL' }]);
const evaluateMaintenanceForUser = vi.fn(async () => undefined);

vi.mock('@/server/services/milestone-progress', () => ({ recomputeActiveMilestonesForUser }));
vi.mock('@/server/services/achievements', () => ({ evaluateAchievementsForUser }));
vi.mock('@/server/services/maintenance', () => ({ evaluateMaintenanceForUser }));

const service = await import('@/server/services/goals-evaluator');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('goals evaluator', () => {
  it('orchestrates milestone recompute before achievement evaluation', async () => {
    const result = await service.evaluateGoalsForUser('u1');

    expect(recomputeActiveMilestonesForUser).toHaveBeenCalledWith('u1');
    expect(evaluateAchievementsForUser).toHaveBeenCalledWith('u1');
    expect(evaluateMaintenanceForUser).toHaveBeenCalledWith('u1');
    expect(result.milestonesEvaluated).toBe(1);
    expect(result.achievements).toEqual([{ code: 'FIRST_MEAL' }]);
  });
});
