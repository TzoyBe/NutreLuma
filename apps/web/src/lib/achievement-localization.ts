type AchievementLike = { code: string; name: string; description: string };

const ENGLISH_ACHIEVEMENTS: Record<string, { name: string; description: string }> = {
  FIRST_MEAL: { name: 'First meal', description: 'Logged your first meal.' },
  MEALS_10: { name: '10 meals', description: 'Logged 10 meals.' },
  MEALS_50: { name: '50 meals', description: 'Logged 50 meals.' },
  MEALS_100: { name: '100 meals', description: 'Logged 100 meals.' },
  STREAK_7: { name: '7-day streak', description: 'Logged meals for 7 days in a row.' },
  STREAK_30: { name: '30-day streak', description: 'Logged meals for 30 days in a row.' },
  FIRST_WEIGH_IN: { name: 'First weigh-in', description: 'Logged your weight for the first time.' },
  FIRST_KG_LOST: { name: 'First kilogram lost', description: 'Lost your first kilogram.' },
  LOST_5KG: { name: '5 kg lost', description: 'Lost 5 kilograms in total.' },
  LOST_10KG: { name: '10 kg lost', description: 'Lost 10 kilograms in total.' },
  JOURNEY_25: { name: '25% of the journey', description: 'Reached 25% of your weight goal journey.' },
  JOURNEY_50: { name: '50% of the journey', description: 'Reached halfway to your weight goal.' },
  JOURNEY_75: { name: '75% of the journey', description: 'Reached 75% of your weight goal journey.' },
  TARGET_WEIGHT_REACHED: { name: 'Target weight reached', description: 'Reached your target weight.' },
  FIRST_PROTEIN_TARGET: { name: 'Protein target', description: 'Reached your protein target for the first time.' },
  CALORIE_TARGET_5: { name: '5 days on target', description: 'Stayed within your calorie target for 5 days.' },
  FULL_LOGGING_10: { name: '10 fully logged days', description: 'Fully logged your meals for 10 days.' },
  FIRST_SAVED_RECIPE: { name: 'First saved recipe', description: 'Saved your first favorite meal.' },
  FIRST_QUICK_PICK: { name: 'First quick pick', description: 'Used a quick pick for the first time.' },
  CONSISTENT_WEEK: { name: 'Consistent week', description: 'Completed your first consistent week of tracking.' },
  FIRST_WATER_DAY: { name: 'First water target day', description: 'Reached your water target for the first time.' },
  WATER_7: { name: '7 water target days', description: 'Reached your water target on 7 days.' },
  FIRST_ACTIVITY: { name: 'First activity', description: 'Logged your first activity.' },
  ACTIVE_5: { name: '5 active days', description: 'Had 5 active days.' },
  FIRST_MILESTONE: { name: 'First milestone', description: 'Created your first milestone.' },
  FIRST_MILESTONE_DONE: { name: 'First completed milestone', description: 'Completed your first milestone.' },
  MILESTONES_3: { name: '3 completed milestones', description: 'Completed 3 milestones.' },
  MILESTONES_10: { name: '10 completed milestones', description: 'Completed 10 milestones.' },
  MILESTONE_EARLY: { name: 'Ahead of deadline', description: 'Completed a milestone before its deadline.' },
  MAINTENANCE_ACTIVATED: { name: 'New Balance', description: 'Activated maintenance mode.' },
  MAINTENANCE_STABLE_WEEK: { name: 'Stable Week', description: '7 days within your maintenance range.' },
  MAINTENANCE_MONTH: { name: 'One Month of Stability', description: '30 days in maintenance mode.' },
  MAINTENANCE_3M: { name: 'Three Months Maintaining', description: '90 days in maintenance mode.' },
  MAINTENANCE_6M: { name: 'Six Months Maintaining', description: '180 days in maintenance mode.' },
  MAINTENANCE_1Y: { name: 'One Year Maintaining', description: '365 days in maintenance mode.' },
  MAINTENANCE_STEADY_WEEKS: { name: 'Four Steady Weeks', description: '4 weeks without a significant trend.' },
  MAINTENANCE_PROTEIN: { name: 'Consistent Protein', description: '14 days meeting your protein target in maintenance.' },
  MAINTENANCE_CONSISTENT_LOGGING: { name: 'Consistent Logging', description: '30 days of logging in maintenance.' },
  MAINTENANCE_MASTER: { name: 'Maintenance Master', description: '180 days within your maintenance range.' },
};

export function localizeAchievement<T extends AchievementLike>(achievement: T, english: boolean): T {
  if (!english) return achievement;
  const translation = ENGLISH_ACHIEVEMENTS[achievement.code];
  return translation ? { ...achievement, ...translation } : achievement;
}
