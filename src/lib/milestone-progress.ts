/**
 * Pure υπολογισμοί προόδου milestones. Καμία πρόσβαση σε DB — τα δεδομένα
 * περνιούνται έτοιμα από τα services ώστε να είναι πλήρως unit-testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ποσοστό 0..100 ανεξαρτήτως κατεύθυνσης (loss: start>target, count: start=0). */
export function milestonePercent(start: number, current: number, target: number): number {
  if (target === start) return current >= target ? 100 : 0;
  const pct = (current - start) / (target - start);
  return Math.round(Math.min(1, Math.max(0, pct)) * 100);
}

/** Απόλυτη υπολειπόμενη απόσταση από τον στόχο. */
export function remainingAmount(current: number, target: number): number {
  return round2(Math.abs(target - current));
}

export interface WeightPoint {
  /** ISO ημερομηνία yyyy-mm-dd. */
  date: string;
  value: number;
}
export type WeightDirection = 'loss' | 'gain';

function parseDay(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}

function sortAsc(points: WeightPoint[]): WeightPoint[] {
  return [...points].sort((a, b) => parseDay(a.date) - parseDay(b.date));
}

/**
 * Τρέχον βάρος: 7-day moving average όταν υπάρχουν ≥3 μετρήσεις μέσα στο
 * παράθυρο των 7 ημερών από την πιο πρόσφατη· αλλιώς η πιο πρόσφατη έγκυρη.
 */
export function resolveWeightCurrent(
  points: WeightPoint[],
  windowDays = 7,
): { value: number; method: 'moving_avg_7d' | 'latest_entry' } | null {
  if (points.length === 0) return null;
  const sorted = sortAsc(points);
  const latest = sorted[sorted.length - 1]!;
  const windowStart = parseDay(latest.date) - (windowDays - 1) * DAY_MS;
  const recent = sorted.filter((p) => parseDay(p.date) >= windowStart);
  if (recent.length >= 3) {
    const avg = recent.reduce((s, p) => s + p.value, 0) / recent.length;
    return { value: round2(avg), method: 'moving_avg_7d' };
  }
  return { value: latest.value, method: 'latest_entry' };
}

/**
 * Έχει επιτευχθεί ο στόχος βάρους; Ολοκληρώνεται όταν το moving average φτάνει
 * τον στόχο, Ή δύο διαδοχικές καταχωρίσεις είναι κοντά στον στόχο (± tolerance).
 * Ποτέ από μία μεμονωμένη ακραία μέτρηση όταν υπάρχει αρκετό ιστορικό.
 */
export function isWeightGoalReached(
  points: WeightPoint[],
  target: number,
  direction: WeightDirection,
  tolerance = 0.2,
): { reached: boolean; method: string } {
  const current = resolveWeightCurrent(points);
  if (!current) return { reached: false, method: 'no_data' };

  const meets = (v: number) => (direction === 'loss' ? v <= target : v >= target);
  if (meets(current.value)) return { reached: true, method: current.method };

  const sorted = sortAsc(points);
  if (sorted.length >= 2) {
    const lastTwo = sorted.slice(-2);
    const near = (v: number) =>
      direction === 'loss' ? v <= target + tolerance : v >= target - tolerance;
    if (lastTwo.every((p) => near(p.value))) {
      return { reached: true, method: 'two_consecutive' };
    }
  }
  return { reached: false, method: current.method };
}

/** Υπονοούμενος ρυθμός αλλαγής βάρους σε kg/εβδομάδα. */
export function impliedWeeklyRateKg(
  start: number,
  target: number,
  startDate: Date,
  endDate: Date,
): number {
  const weeks = (endDate.getTime() - startDate.getTime()) / (7 * DAY_MS);
  if (weeks <= 0) return Infinity;
  return round2(Math.abs(target - start) / weeks);
}

/** Ρυθμός > 1 kg/εβδομάδα θεωρείται επιθετικός (warning, όχι block). */
export function isAggressiveWeeklyRate(rateKg: number): boolean {
  return rateKg > 1.0;
}

/** Μέγιστη σειρά διαδοχικών ημερών από λίστα ISO ημερομηνιών. */
export function longestConsecutiveStreak(daysISO: string[]): number {
  const days = [...new Set(daysISO)].map(parseDay).sort((a, b) => a - b);
  if (days.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i]! - days[i - 1]! === DAY_MS) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}

/** Πλήθος διακριτών ημερών. */
export function countDistinctDays(daysISO: string[]): number {
  return new Set(daysISO).size;
}
