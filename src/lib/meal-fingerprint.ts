import { createHash } from 'node:crypto';

const CALORIE_BUCKET = 25;

/** lowercase, trim, collapse whitespace, strip diacritics (Greek+Latin) & punctuation. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics (accents, tonos, dialytika)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

function bucket(calories: number | null): number {
  if (calories === null || !Number.isFinite(calories)) return 0;
  return Math.round(calories / CALORIE_BUCKET) * CALORIE_BUCKET;
}

export interface FingerprintInput {
  title: string | null;
  mealType: string;
  totalCalories: number | null;
  items: Array<{ name: string; calories: number | null }>;
}

/**
 * Ντετερμινιστικό fingerprint σύνθεσης γεύματος. Ομαδοποιεί «αρκετά κοντινά»
 * γεύματα (bucket 25 kcal ανά τρόφιμο) χωρίς να ενώνει διαφορετικά γεύματα
 * μόνο επειδή έχουν ίδιες συνολικές θερμίδες. Το `source` ΔΕΝ συμμετέχει.
 */
export function computeMealFingerprint(input: FingerprintInput): string {
  const itemSigs = input.items
    .map((i) => `${normalizeText(i.name)}:${bucket(i.calories)}`)
    .sort();

  const titlePart =
    normalizeText(input.title ?? '') ||
    (itemSigs.length > 0
      ? itemSigs.map((s) => s.split(':')[0]).join(' ')
      : String(bucket(input.totalCalories)));

  const canonical = [
    titlePart,
    input.mealType,
    itemSigs.length > 0 ? itemSigs.join(',') : `total:${bucket(input.totalCalories)}`,
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}
