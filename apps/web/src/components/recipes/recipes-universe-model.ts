export type RecipeUniverseInput = {
  hasPlan: boolean;
  remainingCalories: number;
  remainingProteinGrams: number;
  remainingCarbohydrateGrams: number;
  remainingFatGrams: number;
  mealsPlanned: number;
  savedCount: number;
};

export type RecipeUniverseMacro = {
  key: 'protein' | 'carbohydrate' | 'fat';
  label: string;
  value: number | null;
  unit: 'g';
  tone: 'cyan' | 'gold' | 'violet';
};

export type RecipeUniverseModel = {
  calories: number | null;
  macros: RecipeUniverseMacro[];
  journey: { mealsPlanned: string; saved: string };
};

export function buildRecipeUniverseModel(input: RecipeUniverseInput): RecipeUniverseModel {
  return {
    calories: input.hasPlan ? Math.round(input.remainingCalories) : null,
    macros: [
      {
        key: 'protein',
        label: 'Protein',
        value: input.hasPlan ? Math.round(input.remainingProteinGrams) : null,
        unit: 'g',
        tone: 'cyan',
      },
      {
        key: 'carbohydrate',
        label: 'Carbs',
        value: input.hasPlan ? Math.round(input.remainingCarbohydrateGrams) : null,
        unit: 'g',
        tone: 'gold',
      },
      {
        key: 'fat',
        label: 'Fat',
        value: input.hasPlan ? Math.round(input.remainingFatGrams) : null,
        unit: 'g',
        tone: 'violet',
      },
    ],
    journey: {
      mealsPlanned: String(input.mealsPlanned),
      saved: String(input.savedCount),
    },
  };
}
