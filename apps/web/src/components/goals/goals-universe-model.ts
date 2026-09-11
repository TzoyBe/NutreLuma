export type GoalUniverseInput = {
  calorieTarget: number | null;
  proteinGrams: number | null;
  carbohydrateGrams: number | null;
  fatGrams: number | null;
  achievementsUnlocked: number;
  achievementsTotal: number;
  badgesUnlocked: number;
  activeMilestones: number;
  historyCount: number;
};

export type GoalUniverseModel = {
  calories: number | null;
  macros: Array<{
    key: 'protein' | 'carbohydrate' | 'fat';
    label: 'Protein' | 'Carbs' | 'Fat';
    value: number | null;
    unit: 'g';
    tone: 'cyan' | 'gold' | 'violet';
  }>;
  journey: {
    achievements: string;
    badges: string;
    activeMilestones: string;
    history: string;
  };
};

export function buildGoalUniverseModel(input: GoalUniverseInput): GoalUniverseModel {
  return {
    calories: input.calorieTarget,
    macros: [
      { key: 'protein', label: 'Protein', value: input.proteinGrams, unit: 'g', tone: 'cyan' },
      {
        key: 'carbohydrate',
        label: 'Carbs',
        value: input.carbohydrateGrams,
        unit: 'g',
        tone: 'gold',
      },
      { key: 'fat', label: 'Fat', value: input.fatGrams, unit: 'g', tone: 'violet' },
    ],
    journey: {
      achievements: `${input.achievementsUnlocked}/${input.achievementsTotal}`,
      badges: `${input.badgesUnlocked}`,
      activeMilestones: `${input.activeMilestones}`,
      history: `${input.historyCount}`,
    },
  };
}
