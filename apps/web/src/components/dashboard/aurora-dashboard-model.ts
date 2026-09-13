export function safeProgress(current: number, target: number | null): number {
  if (!Number.isFinite(current) || target === null || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(Math.max(current / target, 0), 1);
}

export function buildAuroraSummary(current: number, target: number | null): string {
  if (target === null || target <= 0) return 'Set your daily goals to light up your progress.';
  const percent = Math.round(Math.max(0, current / target) * 100);
  if (percent > 100) {
    return `You're at ${percent}% of your daily goal. You've moved beyond today's target — choose what feels nourishing next.`;
  }
  return `You're at ${percent}% of your daily goal. Plenty of room for a nourishing meal and a refreshing walk.`;
}
