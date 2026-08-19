/**
 * Source of truth for achievements and badges. Seeded idempotently into the
 * database by the achievement service. Each achievement awards one badge (1:1).
 *
 * `metric` and `threshold` are evaluated centrally by the achievement service
 * against a computed `UserMetrics` object.
 */

export type AchievementCategory =
  | 'LOGGING'
  | 'WEIGHT'
  | 'NUTRITION'
  | 'HYDRATION'
  | 'ACTIVITY'
  | 'MILESTONE'
  | 'MAINTENANCE';
export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export type AchievementMetric =
  | 'mealsLogged'
  | 'loggingStreakDays'
  | 'fullLoggingDays'
  | 'weightEntries'
  | 'weightLostKg'
  | 'goalProgressPercent'
  | 'targetWeightReached'
  | 'proteinTargetDays'
  | 'calorieTargetDays'
  | 'savedFavorites'
  | 'quickPickMeals'
  | 'waterTargetDays'
  | 'activityEntries'
  | 'activeDays'
  | 'milestonesCreated'
  | 'milestonesCompleted'
  | 'milestoneBeforeDeadline'
  | 'maintenanceActivated'
  | 'maintenanceDaysInRange'
  | 'maintenanceDurationDays'
  | 'stableWeeks'
  | 'maintenanceProteinDays'
  | 'maintenanceLoggingDays';

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  metric: AchievementMetric;
  threshold: number;
  tier: BadgeTier;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'FIRST_MEAL', name: 'First meal', description: 'You logged your first meal.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 1, tier: 'BRONZE' },
  { code: 'MEALS_10', name: '10 meals logged', description: 'You logged 10 meals.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 10, tier: 'BRONZE' },
  { code: 'MEALS_50', name: '50 meals logged', description: 'You logged 50 meals.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 50, tier: 'SILVER' },
  { code: 'MEALS_100', name: '100 meals logged', description: 'You logged 100 meals.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 100, tier: 'GOLD' },
  { code: 'STREAK_7', name: '7-day streak', description: 'You logged meals for 7 days in a row.', category: 'LOGGING', icon: 'flame', metric: 'loggingStreakDays', threshold: 7, tier: 'SILVER' },
  { code: 'STREAK_30', name: '30-day streak', description: 'You logged meals for 30 days in a row.', category: 'LOGGING', icon: 'flame', metric: 'loggingStreakDays', threshold: 30, tier: 'GOLD' },

  { code: 'FIRST_WEIGH_IN', name: 'First weigh-in', description: 'You logged your weight for the first time.', category: 'WEIGHT', icon: 'scale', metric: 'weightEntries', threshold: 1, tier: 'BRONZE' },
  { code: 'FIRST_KG_LOST', name: 'First kilo lost', description: 'You lost your first kilogram.', category: 'WEIGHT', icon: 'trending-down', metric: 'weightLostKg', threshold: 1, tier: 'BRONZE' },
  { code: 'LOST_5KG', name: '5 kg down', description: 'You lost 5 kilograms in total.', category: 'WEIGHT', icon: 'trending-down', metric: 'weightLostKg', threshold: 5, tier: 'SILVER' },
  { code: 'LOST_10KG', name: '10 kg down', description: 'You lost 10 kilograms in total.', category: 'WEIGHT', icon: 'trending-down', metric: 'weightLostKg', threshold: 10, tier: 'GOLD' },
  { code: 'JOURNEY_25', name: '25% of the journey', description: 'You reached 25% of your target-weight journey.', category: 'WEIGHT', icon: 'milestone', metric: 'goalProgressPercent', threshold: 25, tier: 'BRONZE' },
  { code: 'JOURNEY_50', name: 'Halfway there', description: 'You reached 50% of your target-weight journey.', category: 'WEIGHT', icon: 'milestone', metric: 'goalProgressPercent', threshold: 50, tier: 'SILVER' },
  { code: 'JOURNEY_75', name: '75% of the journey', description: 'You reached 75% of your target-weight journey.', category: 'WEIGHT', icon: 'milestone', metric: 'goalProgressPercent', threshold: 75, tier: 'GOLD' },
  { code: 'TARGET_WEIGHT_REACHED', name: 'Target weight reached', description: 'You reached your target weight.', category: 'WEIGHT', icon: 'trophy', metric: 'targetWeightReached', threshold: 1, tier: 'PLATINUM' },

  { code: 'FIRST_PROTEIN_TARGET', name: 'Protein target hit', description: 'You hit your protein target for the first time.', category: 'NUTRITION', icon: 'egg', metric: 'proteinTargetDays', threshold: 1, tier: 'BRONZE' },
  { code: 'CALORIE_TARGET_5', name: '5 days on target', description: 'You stayed within your calorie target for 5 days.', category: 'NUTRITION', icon: 'target', metric: 'calorieTargetDays', threshold: 5, tier: 'SILVER' },
  { code: 'FULL_LOGGING_10', name: '10 fully logged days', description: 'You completed 10 days of full meal logging.', category: 'NUTRITION', icon: 'clipboard-check', metric: 'fullLoggingDays', threshold: 10, tier: 'SILVER' },
  { code: 'FIRST_SAVED_RECIPE', name: 'First saved favorite', description: 'You saved your first favorite meal.', category: 'NUTRITION', icon: 'bookmark', metric: 'savedFavorites', threshold: 1, tier: 'BRONZE' },
  { code: 'FIRST_QUICK_PICK', name: 'First quick pick', description: 'You used quick pick for the first time.', category: 'NUTRITION', icon: 'zap', metric: 'quickPickMeals', threshold: 1, tier: 'BRONZE' },
  { code: 'CONSISTENT_WEEK', name: 'Consistent week', description: 'You completed your first full, steady week of logging.', category: 'NUTRITION', icon: 'calendar-check', metric: 'fullLoggingDays', threshold: 7, tier: 'SILVER' },

  { code: 'FIRST_WATER_DAY', name: 'First hydration day', description: 'You hit your water target for the first time.', category: 'HYDRATION', icon: 'droplet', metric: 'waterTargetDays', threshold: 1, tier: 'BRONZE' },
  { code: 'WATER_7', name: '7 hydration days', description: 'You hit your water target for 7 days.', category: 'HYDRATION', icon: 'droplet', metric: 'waterTargetDays', threshold: 7, tier: 'SILVER' },
  { code: 'FIRST_ACTIVITY', name: 'First activity logged', description: 'You logged your first activity.', category: 'ACTIVITY', icon: 'activity', metric: 'activityEntries', threshold: 1, tier: 'BRONZE' },
  { code: 'ACTIVE_5', name: '5 active days', description: 'You had 5 active days.', category: 'ACTIVITY', icon: 'activity', metric: 'activeDays', threshold: 5, tier: 'SILVER' },

  { code: 'FIRST_MILESTONE', name: 'First milestone', description: 'You created your first milestone.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCreated', threshold: 1, tier: 'BRONZE' },
  { code: 'FIRST_MILESTONE_DONE', name: 'First milestone completed', description: 'You completed your first milestone.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCompleted', threshold: 1, tier: 'SILVER' },
  { code: 'MILESTONES_3', name: '3 milestones completed', description: 'You completed 3 milestones.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCompleted', threshold: 3, tier: 'GOLD' },
  { code: 'MILESTONES_10', name: '10 milestones completed', description: 'You completed 10 milestones.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCompleted', threshold: 10, tier: 'PLATINUM' },
  { code: 'MILESTONE_EARLY', name: 'Ahead of deadline', description: 'You completed a milestone before its deadline.', category: 'MILESTONE', icon: 'clock', metric: 'milestoneBeforeDeadline', threshold: 1, tier: 'GOLD' },

  { code: 'MAINTENANCE_ACTIVATED', name: 'Maintenance unlocked', description: 'You activated maintenance mode.', category: 'MAINTENANCE', icon: 'scale', metric: 'maintenanceActivated', threshold: 1, tier: 'BRONZE' },
  { code: 'MAINTENANCE_STABLE_WEEK', name: 'Stable week', description: 'You stayed within your maintenance range for 7 days.', category: 'MAINTENANCE', icon: 'calendar-check', metric: 'maintenanceDaysInRange', threshold: 7, tier: 'SILVER' },
  { code: 'MAINTENANCE_MONTH', name: 'One month of maintenance', description: 'You stayed in maintenance mode for 30 days.', category: 'MAINTENANCE', icon: 'calendar', metric: 'maintenanceDurationDays', threshold: 30, tier: 'SILVER' },
  { code: 'MAINTENANCE_3M', name: 'Three months of maintenance', description: 'You stayed in maintenance mode for 90 days.', category: 'MAINTENANCE', icon: 'calendar', metric: 'maintenanceDurationDays', threshold: 90, tier: 'GOLD' },
  { code: 'MAINTENANCE_6M', name: 'Six months of maintenance', description: 'You stayed in maintenance mode for 180 days.', category: 'MAINTENANCE', icon: 'calendar', metric: 'maintenanceDurationDays', threshold: 180, tier: 'GOLD' },
  { code: 'MAINTENANCE_1Y', name: 'One year of maintenance', description: 'You stayed in maintenance mode for 365 days.', category: 'MAINTENANCE', icon: 'award', metric: 'maintenanceDurationDays', threshold: 365, tier: 'PLATINUM' },
  { code: 'MAINTENANCE_STEADY_WEEKS', name: 'Four steady weeks', description: 'You maintained four weeks without a major trend drift.', category: 'MAINTENANCE', icon: 'trending-up', metric: 'stableWeeks', threshold: 4, tier: 'GOLD' },
  { code: 'MAINTENANCE_PROTEIN', name: 'Consistent protein', description: 'You hit your protein target on 14 maintenance days.', category: 'MAINTENANCE', icon: 'egg', metric: 'maintenanceProteinDays', threshold: 14, tier: 'SILVER' },
  { code: 'MAINTENANCE_CONSISTENT_LOGGING', name: 'Consistent maintenance logging', description: 'You logged 30 days during maintenance.', category: 'MAINTENANCE', icon: 'clipboard-check', metric: 'maintenanceLoggingDays', threshold: 30, tier: 'SILVER' },
  { code: 'MAINTENANCE_MASTER', name: 'Maintenance master', description: 'You spent 180 days within your maintenance range.', category: 'MAINTENANCE', icon: 'trophy', metric: 'maintenanceDaysInRange', threshold: 180, tier: 'PLATINUM' },
];

export interface BadgeDef {
  code: string;
  name: string;
  description: string;
  iconKey: string;
  category: AchievementCategory;
  tier: BadgeTier;
  criteria: string;
}

export const badgeCodeFor = (achievementCode: string): string => `BADGE_${achievementCode}`;

export const BADGES: BadgeDef[] = ACHIEVEMENTS.map((achievement) => ({
  code: badgeCodeFor(achievement.code),
  name: achievement.name,
  description: achievement.description,
  iconKey: achievement.icon,
  category: achievement.category,
  tier: achievement.tier,
  criteria: achievement.description,
}));
