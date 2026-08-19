/**
 * Pure υπολογισμοί συντήρησης βάρους. Καμία πρόσβαση σε DB — τα δεδομένα
 * περνιούνται έτοιμα από τα services, ώστε όλη η λογική να είναι unit-testable.
 *
 * Καμία τιμή δεν είναι ιατρική αξιολόγηση· όλα είναι ντετερμινιστικές εκτιμήσεις.
 */
import { resolveWeightCurrent, type WeightDirection, type WeightPoint } from './milestone-progress';

const DAY_MS = 24 * 60 * 60 * 1000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function parseDay(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}
function sortAsc(points: WeightPoint[]): WeightPoint[] {
  return [...points].sort((a, b) => parseDay(a.date) - parseDay(b.date));
}

export type MaintenanceStatus =
  | 'WITHIN_RANGE'
  | 'NEAR_UPPER'
  | 'NEAR_LOWER'
  | 'ABOVE_RANGE'
  | 'BELOW_RANGE'
  | 'INSUFFICIENT_DATA';

export interface MaintenanceRange {
  lower: number;
  upper: number;
}

// ------------------------------------------------------------------
// Unlock / eligibility
// ------------------------------------------------------------------

/** Ανοχή unlock σε kg = pct του target (default 0.5%). */
export function unlockToleranceKg(target: number, pct = 0.005): number {
  return round2(Math.abs(target) * pct);
}

export interface EligibilityResult {
  eligible: boolean;
  /** no_data | moving_avg_7d | two_consecutive | latest_entry */
  method: string;
  current: number | null;
  toleranceKg: number;
}

/**
 * Έχει φτάσει ο χρήστης το target ώστε να ξεκλειδώσει η συντήρηση;
 *
 * Ασφαλής λογική — ΠΟΤΕ από μία μεμονωμένη μέτρηση:
 *  1) 7-day moving average (≥3 μετρήσεις στο 7ήμερο) έχει φτάσει τον στόχο, ή
 *  2) ≥2 διαδοχικές πρόσφατες μετρήσεις εντός ±tolerance του στόχου.
 */
export function computeMaintenanceEligibility(
  points: WeightPoint[],
  target: number,
  direction: WeightDirection,
  tolerancePct = 0.005,
): EligibilityResult {
  const toleranceKg = unlockToleranceKg(target, tolerancePct);
  const current = resolveWeightCurrent(points);
  if (!current) {
    return { eligible: false, method: 'no_data', current: null, toleranceKg };
  }

  const meets = (v: number) => (direction === 'loss' ? v <= target : v >= target);

  // Path 1: το moving average έχει φτάσει τον στόχο (απαιτεί ≥3 μετρήσεις/7ήμερο).
  if (current.method === 'moving_avg_7d' && meets(current.value)) {
    return { eligible: true, method: 'moving_avg_7d', current: current.value, toleranceKg };
  }

  // Path 2: δύο διαδοχικές πρόσφατες μετρήσεις εντός ±tolerance (ή πέρα από τον στόχο).
  const sorted = sortAsc(points);
  if (sorted.length >= 2) {
    const near = (v: number) => Math.abs(v - target) <= toleranceKg || meets(v);
    const lastTwo = sorted.slice(-2);
    if (lastTwo.every((p) => near(p.value))) {
      return { eligible: true, method: 'two_consecutive', current: current.value, toleranceKg };
    }
  }

  return { eligible: false, method: current.method, current: current.value, toleranceKg };
}

/** Προτεινόμενο εύρος συντήρησης: ±toleranceKg γύρω από τον στόχο (default ±1.5 kg). */
export function suggestMaintenanceRange(target: number, toleranceKg = 1.5): MaintenanceRange {
  const t = Math.abs(toleranceKg);
  return { lower: round1(target - t), upper: round1(target + t) };
}

// ------------------------------------------------------------------
// Trends & variability
// ------------------------------------------------------------------

/** Μέσος όρος βάρους στις τελευταίες `windowDays` ημέρες από την πιο πρόσφατη μέτρηση. */
export function movingAverage(points: WeightPoint[], windowDays: number): number | null {
  if (points.length === 0) return null;
  const sorted = sortAsc(points);
  const latest = sorted[sorted.length - 1]!;
  const windowStart = parseDay(latest.date) - (windowDays - 1) * DAY_MS;
  const recent = sorted.filter((p) => parseDay(p.date) >= windowStart);
  if (recent.length === 0) return null;
  return round2(recent.reduce((s, p) => s + p.value, 0) / recent.length);
}

/** Τυπική απόκλιση (πληθυσμιακή) των τιμών εντός παραθύρου — μέτρο μεταβλητότητας. */
export function weightVariability(points: WeightPoint[], windowDays = 30): number {
  if (points.length === 0) return 0;
  const sorted = sortAsc(points);
  const latest = sorted[sorted.length - 1]!;
  const windowStart = parseDay(latest.date) - (windowDays - 1) * DAY_MS;
  const values = sorted.filter((p) => parseDay(p.date) >= windowStart).map((p) => p.value);
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return round2(Math.sqrt(variance));
}

/** Πλήθος μετρήσεων εντός του εύρους [lower, upper]. */
export function daysWithinRange(points: WeightPoint[], range: MaintenanceRange): number {
  return points.filter((p) => p.value >= range.lower && p.value <= range.upper).length;
}

export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Κατεύθυνση τάσης με least-squares slope (kg/ημέρα) και dead-band.
 * Κλίση εντός ±`deadBandKgPerDay` θεωρείται σταθερή — δεν παράγει τάση από θόρυβο.
 */
export function trendDirection(
  points: WeightPoint[],
  windowDays = 14,
  deadBandKgPerDay = 0.02,
): { direction: TrendDirection; slopeKgPerDay: number } {
  const sorted = sortAsc(points);
  const latest = sorted[sorted.length - 1];
  if (!latest) return { direction: 'stable', slopeKgPerDay: 0 };
  const windowStart = parseDay(latest.date) - (windowDays - 1) * DAY_MS;
  const recent = sorted.filter((p) => parseDay(p.date) >= windowStart);
  if (recent.length < 3) return { direction: 'stable', slopeKgPerDay: 0 };

  const base = parseDay(recent[0]!.date);
  const xs = recent.map((p) => (parseDay(p.date) - base) / DAY_MS);
  const ys = recent.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const direction: TrendDirection =
    slope > deadBandKgPerDay ? 'up' : slope < -deadBandKgPerDay ? 'down' : 'stable';
  return { direction, slopeKgPerDay: round2(slope) };
}

// ------------------------------------------------------------------
// Status classification
// ------------------------------------------------------------------

export interface StatusResult {
  status: MaintenanceStatus;
  center: number;
  distanceFromCenter: number;
}

/**
 * Κατάσταση σε σχέση με το εύρος. `avg` = null → INSUFFICIENT_DATA.
 * `nearBandKg`: ζώνη κοντά στα όρια που σημαίνεται ως NEAR_*.
 */
export function classifyStatus(
  avg: number | null,
  range: MaintenanceRange,
  nearBandKg = 0.3,
): StatusResult {
  const center = round2((range.lower + range.upper) / 2);
  if (avg === null) {
    return { status: 'INSUFFICIENT_DATA', center, distanceFromCenter: 0 };
  }
  const distanceFromCenter = round2(avg - center);
  let status: MaintenanceStatus;
  if (avg > range.upper) status = 'ABOVE_RANGE';
  else if (avg < range.lower) status = 'BELOW_RANGE';
  else if (avg >= range.upper - nearBandKg) status = 'NEAR_UPPER';
  else if (avg <= range.lower + nearBandKg) status = 'NEAR_LOWER';
  else status = 'WITHIN_RANGE';
  return { status, center, distanceFromCenter };
}

// ------------------------------------------------------------------
// Stability score
// ------------------------------------------------------------------

export interface ScoreInputs {
  daysInRange: number;
  totalDays: number;
  weighIns: number;
  expectedWeighIns: number;
  loggedDays: number;
  expectedLogDays: number;
  calorieAvg: number | null;
  calorieTarget: number;
  /** Διαδοχικές ημέρες εκτός ορίων (0 = καμία παρατεταμένη απόκλιση). */
  sustainedDeviationDays: number;
}

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
}

export interface StabilityScore {
  score: number;
  breakdown: ScoreComponent[];
}

function ratio(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(1, Math.max(0, part / whole));
}

/**
 * Ντετερμινιστικό Maintenance Stability Score (0–100) με διαφανή ανάλυση.
 * Δεν τιμωρεί μία μεμονωμένη ημέρα: η παρατεταμένη απόκλιση μετρά μόνο όταν ο
 * caller έχει ήδη διαπιστώσει ≥ threshold διαδοχικές ημέρες.
 */
export function computeStabilityScore(input: ScoreInputs): StabilityScore {
  const inRange = 35 * ratio(input.daysInRange, input.totalDays);
  const weighIn = 20 * ratio(input.weighIns, input.expectedWeighIns);
  const logging = 20 * ratio(input.loggedDays, input.expectedLogDays);

  let calorie = 0;
  if (input.calorieAvg !== null && input.calorieTarget > 0) {
    const deviation = Math.abs(input.calorieAvg - input.calorieTarget) / input.calorieTarget;
    calorie = 15 * Math.max(0, 1 - Math.min(1, deviation / 0.2)); // πλήρες <5%, μηδέν ≥25% απόκλιση
  }

  const noDeviation = 10 * Math.max(0, 1 - ratio(input.sustainedDeviationDays, 14));

  const breakdown: ScoreComponent[] = [
    { key: 'inRange', label: 'Days within range', points: round1(inRange), max: 35 },
    { key: 'weighIn', label: 'Weigh-in frequency', points: round1(weighIn), max: 20 },
    { key: 'logging', label: 'Logging completeness', points: round1(logging), max: 20 },
    { key: 'calorie', label: 'Calorie consistency', points: round1(calorie), max: 15 },
    { key: 'noDeviation', label: 'No sustained deviation', points: round1(noDeviation), max: 10 },
  ];
  const score = Math.round(breakdown.reduce((s, c) => s + c.points, 0));
  return { score: Math.min(100, score), breakdown };
}

// ------------------------------------------------------------------
// Alerts & recommendations (ντετερμινιστικά, ουδέτερα μηνύματα)
// ------------------------------------------------------------------

export type AlertSensitivity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AlertContext {
  dayISO: string;
  status: MaintenanceStatus;
  sustainedAboveDays: number;
  sustainedBelowDays: number;
  weighInsLast7: number;
  expectedWeighInsLast7: number;
  trend: TrendDirection;
  trendDays: number;
}

export interface MaintenanceAlertDraft {
  type:
    | 'APPROACHING_UPPER'
    | 'ABOVE_RANGE_SUSTAINED'
    | 'BELOW_RANGE_SUSTAINED'
    | 'INSUFFICIENT_WEIGH_INS'
    | 'PERSISTENT_UPWARD_TREND'
    | 'PERSISTENT_DOWNWARD_TREND';
  severity: 'INFO' | 'ATTENTION';
  message: string;
  dedupeKey: string;
}

/** Κατώφλι διαδοχικών ημερών για «παρατεταμένη» απόκλιση, ανά ευαισθησία. */
export function sustainedThreshold(sensitivity: AlertSensitivity): number {
  return sensitivity === 'HIGH' ? 3 : sensitivity === 'LOW' ? 7 : 5;
}

function weekBucket(dayISO: string): string {
  const d = new Date(`${dayISO}T00:00:00.000Z`);
  const day = (d.getUTCDay() + 6) % 7; // Δευτέρα = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Παράγει ουδέτερα alerts. ΠΟΤΕ από μία μεμονωμένη μέτρηση — όλα τα κατώφλια
 * είναι ≥3 διαδοχικές ημέρες. dedupeKey ανά εβδομάδα ώστε να μη γίνεται spam.
 */
export function deriveAlerts(
  ctx: AlertContext,
  sensitivity: AlertSensitivity,
): MaintenanceAlertDraft[] {
  const alerts: MaintenanceAlertDraft[] = [];
  const threshold = sustainedThreshold(sensitivity);
  const week = weekBucket(ctx.dayISO);

  if (ctx.weighInsLast7 < 2) {
    alerts.push({
      type: 'INSUFFICIENT_WEIGH_INS',
      severity: 'INFO',
      message:
        'There aren’t enough recent weigh-ins to read your weekly average reliably. A couple more entries this week will help.',
      dedupeKey: `INSUFFICIENT_WEIGH_INS:${week}`,
    });
    return alerts; // χωρίς αρκετά δεδομένα δεν βγάζουμε άλλα alerts βάρους
  }

  if (ctx.sustainedAboveDays >= threshold) {
    alerts.push({
      type: 'ABOVE_RANGE_SUSTAINED',
      severity: 'ATTENTION',
      message:
        'Your weekly average has stayed above the maintenance range for several days. It may be worth reviewing your recent entries.',
      dedupeKey: `ABOVE_RANGE_SUSTAINED:${week}`,
    });
  } else if (ctx.status === 'NEAR_UPPER') {
    alerts.push({
      type: 'APPROACHING_UPPER',
      severity: 'INFO',
      message:
        'Your weekly average is moving close to the upper edge of your maintenance range. It may be worth a look at your recent entries.',
      dedupeKey: `APPROACHING_UPPER:${week}`,
    });
  }

  if (ctx.sustainedBelowDays >= threshold) {
    alerts.push({
      type: 'BELOW_RANGE_SUSTAINED',
      severity: 'ATTENTION',
      message:
        'Your weekly average has stayed below the maintenance range for several days. You might want to review your recent entries.',
      dedupeKey: `BELOW_RANGE_SUSTAINED:${week}`,
    });
  }

  if (ctx.trend === 'up' && ctx.trendDays >= threshold) {
    alerts.push({
      type: 'PERSISTENT_UPWARD_TREND',
      severity: 'INFO',
      message:
        'Your weight shows a gentle upward trend over the last couple of weeks. A steady check-in can help you stay in range.',
      dedupeKey: `PERSISTENT_UPWARD_TREND:${week}`,
    });
  } else if (ctx.trend === 'down' && ctx.trendDays >= threshold) {
    alerts.push({
      type: 'PERSISTENT_DOWNWARD_TREND',
      severity: 'INFO',
      message:
        'Your weight shows a gentle downward trend over the last couple of weeks. A steady check-in can help you stay in range.',
      dedupeKey: `PERSISTENT_DOWNWARD_TREND:${week}`,
    });
  }

  return alerts;
}

export interface RecommendationContext {
  status: MaintenanceStatus;
  loggedDays: number;
  expectedLogDays: number;
  trend: TrendDirection;
}

export interface MaintenanceRecommendation {
  key: string;
  message: string;
}

/**
 * Ντετερμινιστικές, ουδέτερες προτάσεις. Καμία αυτόματη αλλαγή θερμίδων —
 * απλώς επιλογές που ο χρήστης επιβεβαιώνει, με μικρά βήματα.
 */
export function deriveRecommendations(ctx: RecommendationContext): MaintenanceRecommendation[] {
  const recs: MaintenanceRecommendation[] = [];

  if (ctx.loggedDays < ctx.expectedLogDays * 0.6) {
    recs.push({
      key: 'improve_logging',
      message: 'Improve your logging consistency for a few days before changing your target.',
    });
    return recs;
  }

  if (ctx.status === 'INSUFFICIENT_DATA') {
    recs.push({
      key: 'keep_tracking',
      message: 'Keep logging your weight so we can read your weekly average.',
    });
    return recs;
  }

  if (ctx.status === 'WITHIN_RANGE' && ctx.trend === 'stable') {
    recs.push({ key: 'keep_target', message: 'Keep your current target — things look steady.' });
    return recs;
  }

  if (ctx.status === 'ABOVE_RANGE' || ctx.status === 'NEAR_UPPER' || ctx.trend === 'up') {
    recs.push({ key: 'monitor_week', message: 'Monitor for another week before making changes.' });
    recs.push({
      key: 'small_adjustment',
      message: 'Consider a small calorie adjustment (a step of about 100 kcal).',
    });
    return recs;
  }

  if (ctx.status === 'BELOW_RANGE' || ctx.status === 'NEAR_LOWER' || ctx.trend === 'down') {
    recs.push({ key: 'monitor_week', message: 'Monitor for another week before making changes.' });
    recs.push({
      key: 'small_adjustment',
      message: 'Consider a small calorie adjustment (a step of about 100 kcal).',
    });
    return recs;
  }

  recs.push({ key: 'keep_target', message: 'Keep your current target — things look steady.' });
  return recs;
}
