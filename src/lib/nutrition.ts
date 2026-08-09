import type { Goal } from './calories';

/**
 * Καθαρή λογική μακροθρεπτικών. Χωρίς I/O, ώστε να είναι πλήρως testable.
 *
 * ΠΡΟΣΟΧΗ: όλα εδώ είναι γενικές εκτιμήσεις, όχι διατροφική συμβουλή.
 */

export const KCAL_PER_GRAM = {
  protein: 4,
  carbohydrate: 4,
  fat: 9,
} as const;

/** Πόσα γραμμάρια ινών ανά 1000 kcal — ευρέως χρησιμοποιούμενη αναφορά. */
const FIBER_GRAMS_PER_1000_KCAL = 14;

/** Ανώτατο όριο προτεινόμενων ινών, ώστε να μην προτείνονται ακραίες τιμές. */
const MAX_SUGGESTED_FIBER = 50;

export interface MacroTargets {
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

/**
 * Κατανομή θερμίδων ανά στόχο. Οι τιμές αθροίζουν σε 1.
 * Σε απώλεια βάρους δίνεται μεγαλύτερο ποσοστό πρωτεΐνης, που βοηθά στη
 * διατήρηση μυϊκής μάζας — συντηρητική, ευρέως αποδεκτή επιλογή.
 */
const SPLIT: Record<Goal, { protein: number; carbohydrate: number; fat: number }> = {
  LOSE: { protein: 0.3, carbohydrate: 0.35, fat: 0.35 },
  MAINTAIN: { protein: 0.25, carbohydrate: 0.45, fat: 0.3 },
  GAIN: { protein: 0.25, carbohydrate: 0.5, fat: 0.25 },
};

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

/** Προτεινόμενοι στόχοι macros από τις ημερήσιες θερμίδες. */
export function suggestMacroTargets(calorieTarget: number, goal: Goal): MacroTargets {
  const calories = Math.max(0, Math.round(calorieTarget));
  const split = SPLIT[goal] ?? SPLIT.MAINTAIN;

  return {
    proteinGrams: roundToFive((calories * split.protein) / KCAL_PER_GRAM.protein),
    carbohydrateGrams: roundToFive((calories * split.carbohydrate) / KCAL_PER_GRAM.carbohydrate),
    fatGrams: roundToFive((calories * split.fat) / KCAL_PER_GRAM.fat),
    fiberGrams: Math.min(
      MAX_SUGGESTED_FIBER,
      Math.round((calories / 1000) * FIBER_GRAMS_PER_1000_KCAL),
    ),
  };
}

/** Θερμίδες που αντιστοιχούν σε ένα σύνολο macros (έλεγχος συνέπειας). */
export function caloriesFromMacros(macros: {
  proteinGrams?: number | null;
  carbohydrateGrams?: number | null;
  fatGrams?: number | null;
}): number {
  return Math.round(
    (macros.proteinGrams ?? 0) * KCAL_PER_GRAM.protein +
      (macros.carbohydrateGrams ?? 0) * KCAL_PER_GRAM.carbohydrate +
      (macros.fatGrams ?? 0) * KCAL_PER_GRAM.fat,
  );
}

export interface MacroProgress {
  consumed: number;
  target: number | null;
  remaining: number | null;
  progressPercent: number;
  overTarget: boolean;
}

/**
 * Πρόοδος ενός macro. Το `progressPercent` περιορίζεται στο 100 για τη μπάρα,
 * αλλά το `overTarget` δείχνει την πραγματική υπέρβαση.
 */
export function buildMacroProgress(consumed: number, target: number | null): MacroProgress {
  const safeConsumed = Math.max(0, Math.round(consumed * 10) / 10);
  if (target === null || target <= 0) {
    return {
      consumed: safeConsumed,
      target: null,
      remaining: null,
      progressPercent: 0,
      overTarget: false,
    };
  }
  return {
    consumed: safeConsumed,
    target,
    remaining: Math.round((target - safeConsumed) * 10) / 10,
    progressPercent: Math.min(100, Math.round((safeConsumed / target) * 100)),
    overTarget: safeConsumed > target,
  };
}
