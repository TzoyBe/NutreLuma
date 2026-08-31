export type MilestoneStatusFilter = 'ALL' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

type MilestoneWithStatus = { status: string };

const IN_PROGRESS_STATUSES = new Set(['ACTIVE', 'PAUSED']);
const HISTORY_STATUSES = new Set(['COMPLETED', 'MISSED', 'CANCELLED']);

export function partitionMilestones<T extends MilestoneWithStatus>(milestones: T[]) {
  return {
    inProgress: milestones.filter((milestone) => IN_PROGRESS_STATUSES.has(milestone.status)),
    history: milestones.filter((milestone) => HISTORY_STATUSES.has(milestone.status)),
  };
}

export function filterMilestoneHistory<T extends MilestoneWithStatus>(
  milestones: T[],
  filter: MilestoneStatusFilter,
) {
  return filter === 'ALL'
    ? milestones
    : milestones.filter((milestone) => milestone.status === filter);
}
