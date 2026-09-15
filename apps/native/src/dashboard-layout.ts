export type DashboardFit = {
  gaugeScale: number;
  mealCardScale: number;
};

const FLEX_ZONE_NATURAL_HEIGHT = 784;

export function getDashboardFit(availableHeight: number | null): DashboardFit {
  const fitRatio = availableHeight === null ? 1 : availableHeight / FLEX_ZONE_NATURAL_HEIGHT;

  return {
    gaugeScale: Math.min(1, Math.max(0.62, fitRatio)),
    // Photo cards include an image and a live blur layer. Keeping their layout
    // dimensions stable avoids an expensive resize when the dashboard settles.
    mealCardScale: 1,
  };
}
