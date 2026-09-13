export type OrbitalMetricKey =
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | 'fiber'
  | 'water'
  | 'steps';

export type OrbitalMetricInput = { current: number; target: number | null };

export type OrbitalDashboardInput = {
  calories: OrbitalMetricInput;
  protein: OrbitalMetricInput;
  carbohydrate: OrbitalMetricInput;
  fat: OrbitalMetricInput;
  fiber: OrbitalMetricInput;
  water: OrbitalMetricInput;
  steps: OrbitalMetricInput;
};

const metricDetails = {
  protein: { label: 'Protein', unit: 'g', color: '#45C8FF' },
  carbohydrate: { label: 'Carbs', unit: 'g', color: '#FFD45F' },
  fat: { label: 'Fat', unit: 'g', color: '#DC55FF' },
  fiber: { label: 'Fibre', unit: 'g', color: '#45E7AE' },
  water: { label: 'Water', unit: 'ml', color: '#4C8DFF' },
  steps: { label: 'Steps', unit: '', color: '#5D85FF' },
} satisfies Record<OrbitalMetricKey, { label: string; unit: string; color: string }>;

export function safeProgress(current: number, target: number | null): number {
  if (!Number.isFinite(current) || target === null || !Number.isFinite(target) || target <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, current / target));
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function buildOrbitalDashboardModel(input: OrbitalDashboardInput, hour = new Date().getHours()) {
  const calorieTarget = input.calories.target;
  const hasCalorieTarget = calorieTarget !== null && calorieTarget > 0;
  const rawPercent = hasCalorieTarget ? (input.calories.current / calorieTarget) * 100 : 0;
  const percent = Math.max(0, Math.round(Number.isFinite(rawPercent) ? rawPercent : 0));
  const metrics = (Object.keys(metricDetails) as OrbitalMetricKey[]).map((key) => ({
    key,
    ...metricDetails[key],
    ...input[key],
    progress: safeProgress(input[key].current, input[key].target),
  }));
  const water = metrics.find((metric) => metric.key === 'water')!;
  const fiber = metrics.find((metric) => metric.key === 'fiber')!;

  return {
    greeting: greetingForHour(hour),
    headline: "You're doing great!",
    calories: {
      ...input.calories,
      progress: safeProgress(input.calories.current, calorieTarget),
      percent,
    },
    metrics,
    insights: [
      {
        title: 'Luma suggests',
        body: water.progress < 0.45 ? "You're low on water. Try a glass now?" : 'Hydration is glowing. Keep your rhythm.',
      },
      {
        title: 'Nutrition tip',
        body: fiber.progress < 0.6 ? 'Add more fibre today for better energy.' : 'Your fibre balance is looking bright.',
      },
    ],
    focus: {
      title: 'Nourish your energy',
      body: hasCalorieTarget
        ? percent > 100
          ? `You're ${percent}% of the way there, beyond today's target.`
          : `You're ${percent}% to your goal. Keep going!`
        : 'Set a daily target to illuminate your progress.',
    },
  };
}
