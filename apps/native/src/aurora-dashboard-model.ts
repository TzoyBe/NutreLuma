import { auroraTheme } from './theme';

export type AuroraMetricKey =
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | 'fiber'
  | 'water'
  | 'steps';

type MetricInput = { current: number; target: number | null };

type AuroraDashboardInput = {
  calories: MetricInput;
  protein: MetricInput;
  carbohydrate: MetricInput;
  fat: MetricInput;
  fiber: MetricInput;
  water: MetricInput;
  steps: MetricInput;
};

const metricCopy: Record<
  AuroraMetricKey,
  { label: string; unit: string; microcopy: string; color: string }
> = {
  protein: { label: 'Protein', unit: 'g', microcopy: 'Build stronger', color: auroraTheme.metrics.protein },
  carbohydrate: { label: 'Carbs', unit: 'g', microcopy: "Energy for what's next", color: auroraTheme.metrics.carbohydrate },
  fat: { label: 'Fat', unit: 'g', microcopy: 'Good fats, bright minds', color: auroraTheme.metrics.fat },
  fiber: { label: 'Fibre', unit: 'g', microcopy: 'A happier you inside', color: auroraTheme.metrics.fiber },
  water: { label: 'Water', unit: 'ml', microcopy: 'Hydrate for a clearer you', color: auroraTheme.metrics.water },
  steps: { label: 'Steps', unit: '', microcopy: 'Move for a brighter mood', color: auroraTheme.metrics.steps },
};

export function clampProgress(current: number, target: number | null): number {
  if (!Number.isFinite(current) || target === null || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(Math.max(current / target, 0), 1);
}

function metric(key: AuroraMetricKey, value: MetricInput) {
  return { key, ...metricCopy[key], ...value, progress: clampProgress(value.current, value.target) };
}

export function buildAuroraDashboardModel(input: AuroraDashboardInput) {
  const hasCalorieTarget = input.calories.target !== null && input.calories.target > 0;
  const rawPercent = hasCalorieTarget ? Math.max(0, input.calories.current / input.calories.target!) * 100 : 0;
  const percent = Math.round(Number.isFinite(rawPercent) ? rawPercent : 0);

  return {
    calories: {
      ...input.calories,
      progress: clampProgress(input.calories.current, input.calories.target),
      percent,
    },
    metrics: (Object.keys(metricCopy) as AuroraMetricKey[]).map((key) => metric(key, input[key])),
    summary: hasCalorieTarget
      ? `You're at ${percent}% of your daily goal. Keep choosing what helps you feel brighter.`
      : 'Set your daily goals to light up your progress.',
  };
}
