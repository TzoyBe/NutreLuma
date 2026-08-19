-- Weight Maintenance Mode: goal mode + history, maintenance profile, range history, alerts.
-- Idempotent & non-destructive: enum guards + CREATE TABLE/INDEX IF NOT EXISTS.

-- ---------- Extend existing enums ----------
ALTER TYPE "AchievementCategory" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
ALTER TYPE "MilestoneType" ADD VALUE IF NOT EXISTS 'MAINTENANCE_DAYS_IN_RANGE';
ALTER TYPE "MilestoneType" ADD VALUE IF NOT EXISTS 'MAINTENANCE_DURATION_DAYS';
ALTER TYPE "MilestoneType" ADD VALUE IF NOT EXISTS 'STABLE_WEEKS';

-- ---------- New enums ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoalMode') THEN
    CREATE TYPE "GoalMode" AS ENUM ('LOSS','MAINTENANCE','GAIN');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceStatus') THEN
    CREATE TYPE "MaintenanceStatus" AS ENUM ('WITHIN_RANGE','NEAR_UPPER','NEAR_LOWER','ABOVE_RANGE','BELOW_RANGE','INSUFFICIENT_DATA');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceAlertType') THEN
    CREATE TYPE "MaintenanceAlertType" AS ENUM ('APPROACHING_UPPER','ABOVE_RANGE_SUSTAINED','BELOW_RANGE_SUSTAINED','INSUFFICIENT_WEIGH_INS','PERSISTENT_UPWARD_TREND','PERSISTENT_DOWNWARD_TREND');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceAlertSeverity') THEN
    CREATE TYPE "MaintenanceAlertSeverity" AS ENUM ('INFO','ATTENTION');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertSensitivity') THEN
    CREATE TYPE "AlertSensitivity" AS ENUM ('LOW','MEDIUM','HIGH');
  END IF;
END $$;

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS "user_goal_modes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "GoalMode" NOT NULL DEFAULT 'LOSS',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_goal_modes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_goal_modes_userId_key" ON "user_goal_modes"("userId");

CREATE TABLE IF NOT EXISTS "goal_mode_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "GoalMode" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "targetWeightKg" DECIMAL(6,2),
    "calorieTarget" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goal_mode_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "goal_mode_history_userId_startDate_idx" ON "goal_mode_history"("userId","startDate");

CREATE TABLE IF NOT EXISTS "maintenance_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetWeightKg" DECIMAL(6,2) NOT NULL,
    "lowerBoundaryKg" DECIMAL(6,2) NOT NULL,
    "upperBoundaryKg" DECIMAL(6,2) NOT NULL,
    "toleranceKg" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "weighInsPerWeek" INTEGER NOT NULL DEFAULT 3,
    "calorieTarget" INTEGER NOT NULL,
    "proteinGrams" DECIMAL(6,2),
    "carbohydrateGrams" DECIMAL(6,2),
    "fatGrams" DECIMAL(6,2),
    "weeklyCalorieMin" INTEGER,
    "weeklyCalorieMax" INTEGER,
    "alertSensitivity" "AlertSensitivity" NOT NULL DEFAULT 'MEDIUM',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_profiles_userId_key" ON "maintenance_profiles"("userId");

CREATE TABLE IF NOT EXISTS "maintenance_range_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetWeightKg" DECIMAL(6,2) NOT NULL,
    "lowerBoundaryKg" DECIMAL(6,2) NOT NULL,
    "upperBoundaryKg" DECIMAL(6,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_range_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "maintenance_range_history_userId_effectiveFrom_idx" ON "maintenance_range_history"("userId","effectiveFrom");

CREATE TABLE IF NOT EXISTS "maintenance_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MaintenanceAlertType" NOT NULL,
    "severity" "MaintenanceAlertSeverity" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    CONSTRAINT "maintenance_alerts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_alerts_userId_dedupeKey_key" ON "maintenance_alerts"("userId","dedupeKey");
CREATE INDEX IF NOT EXISTS "maintenance_alerts_userId_createdAt_idx" ON "maintenance_alerts"("userId","createdAt");

-- ---------- Foreign keys (guarded) ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_goal_modes_userId_fkey') THEN
    ALTER TABLE "user_goal_modes" ADD CONSTRAINT "user_goal_modes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goal_mode_history_userId_fkey') THEN
    ALTER TABLE "goal_mode_history" ADD CONSTRAINT "goal_mode_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_profiles_userId_fkey') THEN
    ALTER TABLE "maintenance_profiles" ADD CONSTRAINT "maintenance_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_range_history_userId_fkey') THEN
    ALTER TABLE "maintenance_range_history" ADD CONSTRAINT "maintenance_range_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_alerts_userId_fkey') THEN
    ALTER TABLE "maintenance_alerts" ADD CONSTRAINT "maintenance_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
