-- Goals feature: milestones, achievements, badges, notifications, water/activity logging.
-- Idempotent & non-destructive: enum guards + CREATE TABLE/INDEX IF NOT EXISTS.

-- ---------- Enums ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MilestoneType') THEN
    CREATE TYPE "MilestoneType" AS ENUM ('TARGET_WEIGHT','WEIGHT_LOSS_AMOUNT','WEIGHT_GAIN_AMOUNT','MEAL_LOGGING_DAYS','MEAL_LOGGING_STREAK','WEIGH_IN_FREQUENCY','CALORIE_TARGET_DAYS','PROTEIN_TARGET_DAYS','WATER_TARGET_DAYS','STEP_TARGET_DAYS','ACTIVITY_TARGET','CUSTOM_NUMERIC');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MilestoneStatus') THEN
    CREATE TYPE "MilestoneStatus" AS ENUM ('DRAFT','ACTIVE','COMPLETED','MISSED','CANCELLED','PAUSED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BadgeTier') THEN
    CREATE TYPE "BadgeTier" AS ENUM ('BRONZE','SILVER','GOLD','PLATINUM');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AchievementCategory') THEN
    CREATE TYPE "AchievementCategory" AS ENUM ('LOGGING','WEIGHT','NUTRITION','HYDRATION','ACTIVITY','MILESTONE');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM ('MILESTONE_DEADLINE','MILESTONE_COMPLETED','MILESTONE_MISSED','MILESTONE_PROGRESS','ACHIEVEMENT_UNLOCKED','BADGE_UNLOCKED');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityKind') THEN
    CREATE TYPE "ActivityKind" AS ENUM ('WORKOUT','WALK','RUN','CYCLE','OTHER');
  END IF;
END $$;

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS "milestones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MilestoneType" NOT NULL,
    "unit" TEXT,
    "startValue" DECIMAL(10,2),
    "targetValue" DECIMAL(10,2) NOT NULL,
    "currentValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dailyThreshold" DECIMAL(10,2),
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "progressMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "milestones_userId_status_idx" ON "milestones"("userId","status");
CREATE INDEX IF NOT EXISTS "milestones_userId_endDate_idx" ON "milestones"("userId","endDate");

CREATE TABLE IF NOT EXISTS "milestone_progress" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "milestone_progress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "milestone_progress_milestoneId_recordedAt_idx" ON "milestone_progress"("milestoneId","recordedAt");

CREATE TABLE IF NOT EXISTS "achievement_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "icon" TEXT NOT NULL,
    "threshold" INTEGER,
    "badgeCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "achievement_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "achievement_definitions_code_key" ON "achievement_definitions"("code");

CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementCode" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_userId_achievementCode_key" ON "user_achievements"("userId","achievementCode");
CREATE INDEX IF NOT EXISTS "user_achievements_userId_idx" ON "user_achievements"("userId");

CREATE TABLE IF NOT EXISTS "badge_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "tier" "BadgeTier" NOT NULL,
    "criteria" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "badge_definitions_code_key" ON "badge_definitions"("code");

CREATE TABLE IF NOT EXISTS "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_badges_userId_badgeCode_key" ON "user_badges"("userId","badgeCode");
CREATE INDEX IF NOT EXISTS "user_badges_userId_idx" ON "user_badges"("userId");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "milestoneId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_userId_dedupeKey_key" ON "notifications"("userId","dedupeKey");
CREATE INDEX IF NOT EXISTS "notifications_userId_readAt_idx" ON "notifications"("userId","readAt");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId","createdAt");

CREATE TABLE IF NOT EXISTS "water_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "water_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "water_entries_userId_entryDate_idx" ON "water_entries"("userId","entryDate");

CREATE TABLE IF NOT EXISTS "activity_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "kind" "ActivityKind" NOT NULL DEFAULT 'OTHER',
    "steps" INTEGER,
    "durationMin" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "activity_entries_userId_entryDate_idx" ON "activity_entries"("userId","entryDate");

-- ---------- Foreign keys (guarded) ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'milestones_userId_fkey') THEN
    ALTER TABLE "milestones" ADD CONSTRAINT "milestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'milestone_progress_milestoneId_fkey') THEN
    ALTER TABLE "milestone_progress" ADD CONSTRAINT "milestone_progress_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_userId_fkey') THEN
    ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_badges_userId_fkey') THEN
    ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_userId_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'water_entries_userId_fkey') THEN
    ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_entries_userId_fkey') THEN
    ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
