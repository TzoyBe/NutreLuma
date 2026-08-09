import type { MealType } from '@prisma/client';

/** Client-safe τύποι για το quick-pick UI (χωρίς import server-only κώδικα). */

export type QuickPickRef =
  | { kind: 'favorite'; id: string }
  | { kind: 'frequent'; fingerprint: string }
  | { kind: 'recent'; mealId: string };

export interface QuickMacros {
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  saturatedFatGrams: number | null;
  sodiumMg: number | null;
}

/** Ενιαίο μοντέλο κάρτας — και οι τρεις πηγές το γεμίζουν. */
export interface QuickPickCardModel {
  ref: QuickPickRef;
  title: string;
  mealType: MealType;
  calories: number | null;
  macros: QuickMacros;
  thumbUrl: string | null;
  isFavorite: boolean;
  favoriteId: string | null;
  usageCount?: number;
  lastUsedAt?: string;
}

export interface QuickPickPreviewResponse {
  title: string | null;
  mealType: MealType;
  multiplier: number;
  composition: {
    finalCalories: number | null;
    macros: QuickMacros;
    items: Array<{
      name: string;
      estimatedQuantity: string | null;
      finalCalories: number | null;
      macros: QuickMacros;
    }>;
  };
}
