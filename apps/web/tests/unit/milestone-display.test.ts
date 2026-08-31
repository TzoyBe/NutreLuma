import { describe, expect, it } from 'vitest';
import {
  filterMilestoneHistory,
  partitionMilestones,
  type MilestoneStatusFilter,
} from '../../src/lib/milestone-display';

const milestones = [
  { id: 'active', status: 'ACTIVE' },
  { id: 'paused', status: 'PAUSED' },
  { id: 'completed', status: 'COMPLETED' },
  { id: 'missed', status: 'MISSED' },
  { id: 'cancelled', status: 'CANCELLED' },
  { id: 'draft', status: 'DRAFT' },
];

describe('milestone display groups', () => {
  it('keeps active and paused milestones out of history', () => {
    const result = partitionMilestones(milestones);

    expect(result.inProgress.map((item) => item.id)).toEqual(['active', 'paused']);
    expect(result.history.map((item) => item.id)).toEqual(['completed', 'missed', 'cancelled']);
  });

  it.each<[MilestoneStatusFilter, string[]]>([
    ['COMPLETED', ['completed']],
    ['MISSED', ['missed']],
    ['CANCELLED', ['cancelled']],
    ['ALL', ['completed', 'missed', 'cancelled']],
  ])('filters history by %s', (filter, expectedIds) => {
    const { history } = partitionMilestones(milestones);

    expect(filterMilestoneHistory(history, filter).map((item) => item.id)).toEqual(expectedIds);
  });
});
