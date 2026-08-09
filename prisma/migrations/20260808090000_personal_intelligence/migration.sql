-- Personal intelligence layer. All additions are nullable or safely defaulted.
ALTER TABLE "meals" ADD COLUMN "calibratedAiCalories" INTEGER;
ALTER TABLE "meals" ADD COLUMN "dataConfidence" DOUBLE PRECISION;
ALTER TABLE "meals" ADD COLUMN "confidenceFactors" JSONB;
ALTER TABLE "meals" ADD COLUMN "beforeImagePath" TEXT;
ALTER TABLE "meals" ADD COLUMN "afterImagePath" TEXT;
ALTER TABLE "meals" ADD COLUMN "beforeEstimateCalories" INTEGER;
ALTER TABLE "meals" ADD COLUMN "remainingEstimateCalories" INTEGER;
ALTER TABLE "meals" ADD COLUMN "estimatedConsumedPercent" DOUBLE PRECISION;
ALTER TABLE "meals" ADD COLUMN "estimatedConsumedCalories" INTEGER;
ALTER TABLE "meals" ADD COLUMN "finalConfirmedConsumedCalories" INTEGER;
ALTER TABLE "meals" ADD COLUMN "beforeAfterConfidence" DOUBLE PRECISION;
ALTER TABLE "meal_items" ADD COLUMN "baseQuantity" TEXT;
ALTER TABLE "meal_items" ADD COLUMN "calibratedQuantity" TEXT;
ALTER TABLE "meal_items" ADD COLUMN "consumedPercent" DOUBLE PRECISION;

CREATE TABLE "user_calibration_facts" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "key" TEXT NOT NULL,
  "valueJson" JSONB NOT NULL, "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sampleCount" INTEGER NOT NULL DEFAULT 0, "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_calibration_facts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_calibration_facts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_calibration_facts_userId_key_key" ON "user_calibration_facts"("userId", "key");
CREATE INDEX "user_calibration_facts_userId_updatedAt_idx" ON "user_calibration_facts"("userId", "updatedAt");

CREATE TABLE "meal_corrections" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "mealId" TEXT NOT NULL,
  "originalJson" JSONB NOT NULL, "finalJson" JSONB NOT NULL, "calorieDifference" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meal_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meal_corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meal_corrections_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "meal_corrections_userId_createdAt_idx" ON "meal_corrections"("userId", "createdAt");
CREATE INDEX "meal_corrections_userId_mealId_idx" ON "meal_corrections"("userId", "mealId");

CREATE TABLE "personal_intelligence_settings" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "personalCalibration" BOOLEAN NOT NULL DEFAULT true, "useMealHistory" BOOLEAN NOT NULL DEFAULT true,
  "useWeightHistory" BOOLEAN NOT NULL DEFAULT true, "useBehaviorPatterns" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "personal_intelligence_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "personal_intelligence_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "personal_intelligence_settings_userId_key" ON "personal_intelligence_settings"("userId");

CREATE TABLE "personal_energy_estimates" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
  "estimatedCalories" INTEGER NOT NULL, "formulaCalories" INTEGER, "confidence" DOUBLE PRECISION NOT NULL,
  "weightSamples" INTEGER NOT NULL, "completeDays" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "personal_energy_estimates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "personal_energy_estimates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "personal_energy_estimates_userId_endDate_idx" ON "personal_energy_estimates"("userId", "endDate");

CREATE TABLE "user_patterns" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "message" TEXT NOT NULL,
  "dateRange" JSONB NOT NULL, "sampleCount" INTEGER NOT NULL, "confidence" DOUBLE PRECISION NOT NULL,
  "completeness" DOUBLE PRECISION NOT NULL, "deterministic" BOOLEAN NOT NULL DEFAULT true,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_patterns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_patterns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "user_patterns_userId_generatedAt_idx" ON "user_patterns"("userId", "generatedAt");

CREATE TABLE "plate_profiles" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "diameterMm" INTEGER NOT NULL,
  "shape" TEXT NOT NULL DEFAULT 'round', "imagePath" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plate_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plate_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "plate_profiles_userId_idx" ON "plate_profiles"("userId");

CREATE TABLE "explicit_meal_skips" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "mealType" "MealType" NOT NULL, "entryDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "explicit_meal_skips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "explicit_meal_skips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "explicit_meal_skips_userId_mealType_entryDate_key" ON "explicit_meal_skips"("userId", "mealType", "entryDate");
CREATE INDEX "explicit_meal_skips_userId_entryDate_idx" ON "explicit_meal_skips"("userId", "entryDate");

CREATE TABLE "weekly_budgets" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "weekStart" DATE NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
  "totalCalories" INTEGER NOT NULL, "dailyPlan" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_budgets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "weekly_budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "weekly_budgets_userId_weekStart_key" ON "weekly_budgets"("userId", "weekStart");
