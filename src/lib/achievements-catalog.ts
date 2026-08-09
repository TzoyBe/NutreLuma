/**
 * Source of truth για achievements & badges. Seed idempotent στη βάση από το
 * AchievementService. Κάθε achievement απονέμει ένα badge (1:1).
 *
 * `metric`/`threshold`: το AchievementService υπολογίζει ένα UserMetrics object
 * και απονέμει το achievement όταν metrics[metric] >= threshold. Έτσι η λογική
 * μένει κεντρική και data-driven, χωρίς if/else ανά achievement.
 */

export type AchievementCategory = 'LOGGING' | 'WEIGHT' | 'NUTRITION' | 'HYDRATION' | 'ACTIVITY' | 'MILESTONE' | 'MAINTENANCE';
export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

/** Μετρικές που υπολογίζει ο evaluator από πραγματικά δεδομένα. */
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
  /** Απονέμεται όταν metrics[metric] >= threshold. Boolean metrics → 1. */
  threshold: number;
  tier: BadgeTier;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Καταγραφή ---
  { code: 'FIRST_MEAL', name: 'Πρώτο γεύμα', description: 'Κατέγραψες το πρώτο σου γεύμα.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 1, tier: 'BRONZE' },
  { code: 'MEALS_10', name: '10 γεύματα', description: 'Κατέγραψες 10 γεύματα.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 10, tier: 'BRONZE' },
  { code: 'MEALS_50', name: '50 γεύματα', description: 'Κατέγραψες 50 γεύματα.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 50, tier: 'SILVER' },
  { code: 'MEALS_100', name: '100 γεύματα', description: 'Κατέγραψες 100 γεύματα.', category: 'LOGGING', icon: 'utensils', metric: 'mealsLogged', threshold: 100, tier: 'GOLD' },
  { code: 'STREAK_7', name: '7 συνεχόμενες ημέρες', description: 'Κατέγραψες γεύματα 7 ημέρες στη σειρά.', category: 'LOGGING', icon: 'flame', metric: 'loggingStreakDays', threshold: 7, tier: 'SILVER' },
  { code: 'STREAK_30', name: '30 συνεχόμενες ημέρες', description: 'Κατέγραψες γεύματα 30 ημέρες στη σειρά.', category: 'LOGGING', icon: 'flame', metric: 'loggingStreakDays', threshold: 30, tier: 'GOLD' },

  // --- Βάρος ---
  { code: 'FIRST_WEIGH_IN', name: 'Πρώτη ζύγιση', description: 'Κατέγραψες το βάρος σου για πρώτη φορά.', category: 'WEIGHT', icon: 'scale', metric: 'weightEntries', threshold: 1, tier: 'BRONZE' },
  { code: 'FIRST_KG_LOST', name: 'Πρώτο χαμένο κιλό', description: 'Έχασες το πρώτο σου κιλό.', category: 'WEIGHT', icon: 'trending-down', metric: 'weightLostKg', threshold: 1, tier: 'BRONZE' },
  { code: 'LOST_5KG', name: '5 kg απώλεια', description: 'Έχασες συνολικά 5 kg.', category: 'WEIGHT', icon: 'trending-down', metric: 'weightLostKg', threshold: 5, tier: 'SILVER' },
  { code: 'LOST_10KG', name: '10 kg απώλεια', description: 'Έχασες συνολικά 10 kg.', category: 'WEIGHT', icon: 'trending-down', metric: 'weightLostKg', threshold: 10, tier: 'GOLD' },
  { code: 'JOURNEY_25', name: '25% της διαδρομής', description: 'Έφτασες το 25% προς τον στόχο βάρους.', category: 'WEIGHT', icon: 'milestone', metric: 'goalProgressPercent', threshold: 25, tier: 'BRONZE' },
  { code: 'JOURNEY_50', name: '50% της διαδρομής', description: 'Έφτασες τα μισά της διαδρομής προς τον στόχο.', category: 'WEIGHT', icon: 'milestone', metric: 'goalProgressPercent', threshold: 50, tier: 'SILVER' },
  { code: 'JOURNEY_75', name: '75% της διαδρομής', description: 'Έφτασες το 75% προς τον στόχο βάρους.', category: 'WEIGHT', icon: 'milestone', metric: 'goalProgressPercent', threshold: 75, tier: 'GOLD' },
  { code: 'TARGET_WEIGHT_REACHED', name: 'Στόχος βάρους!', description: 'Έφτασες το επιθυμητό σου βάρος.', category: 'WEIGHT', icon: 'trophy', metric: 'targetWeightReached', threshold: 1, tier: 'PLATINUM' },

  // --- Διατροφή ---
  { code: 'FIRST_PROTEIN_TARGET', name: 'Στόχος πρωτεΐνης', description: 'Πέτυχες τον στόχο πρωτεΐνης για πρώτη φορά.', category: 'NUTRITION', icon: 'egg', metric: 'proteinTargetDays', threshold: 1, tier: 'BRONZE' },
  { code: 'CALORIE_TARGET_5', name: '5 ημέρες στον στόχο', description: '5 ημέρες μέσα στον στόχο θερμίδων.', category: 'NUTRITION', icon: 'target', metric: 'calorieTargetDays', threshold: 5, tier: 'SILVER' },
  { code: 'FULL_LOGGING_10', name: '10 ημέρες πλήρους καταγραφής', description: '10 ημέρες με πλήρη καταγραφή γευμάτων.', category: 'NUTRITION', icon: 'clipboard-check', metric: 'fullLoggingDays', threshold: 10, tier: 'SILVER' },
  { code: 'FIRST_SAVED_RECIPE', name: 'Πρώτη αποθήκευση', description: 'Αποθήκευσες το πρώτο σου αγαπημένο γεύμα.', category: 'NUTRITION', icon: 'bookmark', metric: 'savedFavorites', threshold: 1, tier: 'BRONZE' },
  { code: 'FIRST_QUICK_PICK', name: 'Πρώτο quick-pick', description: 'Χρησιμοποίησες quick-pick για πρώτη φορά.', category: 'NUTRITION', icon: 'zap', metric: 'quickPickMeals', threshold: 1, tier: 'BRONZE' },
  { code: 'CONSISTENT_WEEK', name: 'Σταθερή εβδομάδα', description: 'Πρώτη εβδομάδα με σταθερή, πλήρη καταγραφή.', category: 'NUTRITION', icon: 'calendar-check', metric: 'fullLoggingDays', threshold: 7, tier: 'SILVER' },

  // --- Νερό & δραστηριότητα ---
  { code: 'FIRST_WATER_DAY', name: 'Πρώτη ημέρα νερού', description: 'Πέτυχες τον στόχο νερού για πρώτη φορά.', category: 'HYDRATION', icon: 'droplet', metric: 'waterTargetDays', threshold: 1, tier: 'BRONZE' },
  { code: 'WATER_7', name: '7 ημέρες νερού', description: 'Πέτυχες τον στόχο νερού 7 ημέρες.', category: 'HYDRATION', icon: 'droplet', metric: 'waterTargetDays', threshold: 7, tier: 'SILVER' },
  { code: 'FIRST_ACTIVITY', name: 'Πρώτη δραστηριότητα', description: 'Κατέγραψες την πρώτη σου δραστηριότητα.', category: 'ACTIVITY', icon: 'activity', metric: 'activityEntries', threshold: 1, tier: 'BRONZE' },
  { code: 'ACTIVE_5', name: '5 ενεργές ημέρες', description: 'Είχες 5 ενεργές ημέρες.', category: 'ACTIVITY', icon: 'activity', metric: 'activeDays', threshold: 5, tier: 'SILVER' },

  // --- Milestones ---
  { code: 'FIRST_MILESTONE', name: 'Πρώτο milestone', description: 'Δημιούργησες το πρώτο σου milestone.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCreated', threshold: 1, tier: 'BRONZE' },
  { code: 'FIRST_MILESTONE_DONE', name: 'Πρώτο ολοκληρωμένο', description: 'Ολοκλήρωσες το πρώτο σου milestone.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCompleted', threshold: 1, tier: 'SILVER' },
  { code: 'MILESTONES_3', name: '3 ολοκληρωμένα', description: 'Ολοκλήρωσες 3 milestones.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCompleted', threshold: 3, tier: 'GOLD' },
  { code: 'MILESTONES_10', name: '10 ολοκληρωμένα', description: 'Ολοκλήρωσες 10 milestones.', category: 'MILESTONE', icon: 'flag', metric: 'milestonesCompleted', threshold: 10, tier: 'PLATINUM' },
  { code: 'MILESTONE_EARLY', name: 'Πριν το deadline', description: 'Ολοκλήρωσες milestone πριν από το deadline.', category: 'MILESTONE', icon: 'clock', metric: 'milestoneBeforeDeadline', threshold: 1, tier: 'GOLD' },

  // --- Συντήρηση βάρους ---
  { code: 'MAINTENANCE_ACTIVATED', name: 'Νέα Ισορροπία', description: 'Ενεργοποίησες τη λειτουργία συντήρησης.', category: 'MAINTENANCE', icon: 'scale', metric: 'maintenanceActivated', threshold: 1, tier: 'BRONZE' },
  { code: 'MAINTENANCE_STABLE_WEEK', name: 'Σταθερή Εβδομάδα', description: '7 ημέρες εντός του εύρους συντήρησης.', category: 'MAINTENANCE', icon: 'calendar-check', metric: 'maintenanceDaysInRange', threshold: 7, tier: 'SILVER' },
  { code: 'MAINTENANCE_MONTH', name: 'Ένας Μήνας Σταθερότητας', description: '30 ημέρες σε λειτουργία συντήρησης.', category: 'MAINTENANCE', icon: 'calendar', metric: 'maintenanceDurationDays', threshold: 30, tier: 'SILVER' },
  { code: 'MAINTENANCE_3M', name: 'Τρεις Μήνες Συντήρησης', description: '90 ημέρες σε λειτουργία συντήρησης.', category: 'MAINTENANCE', icon: 'calendar', metric: 'maintenanceDurationDays', threshold: 90, tier: 'GOLD' },
  { code: 'MAINTENANCE_6M', name: 'Έξι Μήνες Συντήρησης', description: '180 ημέρες σε λειτουργία συντήρησης.', category: 'MAINTENANCE', icon: 'calendar', metric: 'maintenanceDurationDays', threshold: 180, tier: 'GOLD' },
  { code: 'MAINTENANCE_1Y', name: 'Ένας Χρόνος Συντήρησης', description: '365 ημέρες σε λειτουργία συντήρησης.', category: 'MAINTENANCE', icon: 'award', metric: 'maintenanceDurationDays', threshold: 365, tier: 'PLATINUM' },
  { code: 'MAINTENANCE_STEADY_WEEKS', name: 'Τέσσερις Σταθερές Εβδομάδες', description: '4 εβδομάδες χωρίς σημαντική τάση.', category: 'MAINTENANCE', icon: 'trending-up', metric: 'stableWeeks', threshold: 4, tier: 'GOLD' },
  { code: 'MAINTENANCE_PROTEIN', name: 'Συνεπής Πρωτεΐνη', description: '14 ημέρες με πετυχημένο στόχο πρωτεΐνης στη συντήρηση.', category: 'MAINTENANCE', icon: 'egg', metric: 'maintenanceProteinDays', threshold: 14, tier: 'SILVER' },
  { code: 'MAINTENANCE_CONSISTENT_LOGGING', name: 'Συνεπής Καταγραφή', description: '30 ημέρες καταγραφής στη συντήρηση.', category: 'MAINTENANCE', icon: 'clipboard-check', metric: 'maintenanceLoggingDays', threshold: 30, tier: 'SILVER' },
  { code: 'MAINTENANCE_MASTER', name: 'Maintenance Master', description: '180 ημέρες εντός του εύρους συντήρησης.', category: 'MAINTENANCE', icon: 'trophy', metric: 'maintenanceDaysInRange', threshold: 180, tier: 'PLATINUM' },
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

/** Ένα badge ανά achievement (1:1). */
export const BADGES: BadgeDef[] = ACHIEVEMENTS.map((a) => ({
  code: badgeCodeFor(a.code),
  name: a.name,
  description: a.description,
  iconKey: a.icon,
  category: a.category,
  tier: a.tier,
  criteria: a.description,
}));
