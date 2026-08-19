/** Κοινές σταθερές domain, διαθέσιμες σε client & server. */

export const MEAL_TYPES = [
  'BREAKFAST',
  'MORNING_SNACK',
  'LUNCH',
  'AFTERNOON_SNACK',
  'DINNER',
  'OTHER',
] as const;
export type MealTypeValue = (typeof MEAL_TYPES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;
export const ACTIVITY_LEVELS = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'] as const;
export const GOALS = ['LOSE', 'MAINTAIN', 'GAIN'] as const;
export const UNITS = ['METRIC', 'IMPERIAL'] as const;
export const ANALYSIS_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;

export const ACTIVITY_FACTORS: Record<(typeof ACTIVITY_LEVELS)[number], number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

/** Ρεαλιστικά όρια — προστατεύουν από λάθος πληκτρολόγηση και από AI outliers. */
export const CALORIE_LIMITS = {
  minPerMeal: 0,
  /** Πάνω από αυτό το όριο ζητείται ρητή επιβεβαίωση από τον χρήστη. */
  softMaxPerMeal: 3000,
  /** Απόλυτο όριο· τίποτα πάνω από αυτό δεν αποθηκεύεται. */
  hardMaxPerMeal: 10_000,
  minDailyTarget: 800,
  maxDailyTarget: 8000,
} as const;

// Το image/heic προστίθεται για τις φωτογραφίες του iPhone: το libvips το
// αποκωδικοποιεί κανονικά και η έξοδος είναι πάντα WebP.
export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

/**
 * Τιμές για το `accept` attribute του file input.
 *
 * Στο iOS Safari μια φωτογραφία HEIC μπορεί να δηλωθεί ως `image/heic`,
 * `image/heif` ή με ΚΕΝΟ MIME. Ο πραγματικός έλεγχος γίνεται server-side με
 * magic bytes· το `accept` απλώς καθοδηγεί τον επιλογέα αρχείων.
 */
export const IMAGE_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export const IMAGE_MAX_DIMENSION = 1280;
export const THUMB_MAX_DIMENSION = 320;

export const DISCLAIMER_EL =
  'Οι θερμίδες που υπολογίζονται από την εφαρμογή αποτελούν εκτίμηση βάσει της φωτογραφίας και ενδέχεται να μην είναι ακριβείς. Η εφαρμογή δεν παρέχει ιατρική ή διατροφική διάγνωση.';
