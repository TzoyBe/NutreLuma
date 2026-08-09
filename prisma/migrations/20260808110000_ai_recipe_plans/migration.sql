CREATE TYPE "AiMealPlanStatus" AS ENUM ('GENERATING','READY','FAILED','EXPIRED','ACCEPTED','PARTIALLY_ACCEPTED');
CREATE TABLE "recipe_preferences" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
  "breakfastPercent" INTEGER NOT NULL DEFAULT 25, "lunchPercent" INTEGER NOT NULL DEFAULT 40, "dinnerPercent" INTEGER NOT NULL DEFAULT 35,
  "cuisines" JSONB, "likedFoods" JSONB, "dislikedFoods" JSONB, "allergies" JSONB, "intolerances" JSONB,
  "maxPrepMinutes" INTEGER NOT NULL DEFAULT 45, "difficulty" TEXT NOT NULL DEFAULT 'EASY', "budgetLevel" TEXT,
  "vegetarianDays" JSONB, "highProtein" BOOLEAN NOT NULL DEFAULT false, "lowPreparation" BOOLEAN NOT NULL DEFAULT false,
  "equipment" JSONB, "preferredUnits" "Units" NOT NULL DEFAULT 'METRIC', "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recipe_preferences_pkey" PRIMARY KEY ("id"), CONSTRAINT "recipe_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "recipe_preferences_userId_key" ON "recipe_preferences"("userId");
CREATE TABLE "pantry_items" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "quantity" TEXT, "expiresAt" DATE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id"), CONSTRAINT "pantry_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "pantry_items_userId_expiresAt_idx" ON "pantry_items"("userId","expiresAt");
CREATE TABLE "ai_meal_plans" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "planDate" DATE NOT NULL, "status" "AiMealPlanStatus" NOT NULL DEFAULT 'GENERATING', "requestFingerprint" TEXT NOT NULL, "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3),
  CONSTRAINT "ai_meal_plans_pkey" PRIMARY KEY ("id"), CONSTRAINT "ai_meal_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ai_meal_plans_userId_planDate_requestFingerprint_key" ON "ai_meal_plans"("userId","planDate","requestFingerprint");
CREATE INDEX "ai_meal_plans_userId_planDate_status_idx" ON "ai_meal_plans"("userId","planDate","status");
CREATE TABLE "ai_meal_plan_recipes" (
  "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "mealType" "MealType" NOT NULL, "title" TEXT NOT NULL, "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_meal_plan_recipes_pkey" PRIMARY KEY ("id"), CONSTRAINT "ai_meal_plan_recipes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ai_meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ai_meal_plan_recipes_planId_mealType_idx" ON "ai_meal_plan_recipes"("planId","mealType");
CREATE TABLE "recipe_feedback" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "planRecipeId" TEXT NOT NULL, "kind" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recipe_feedback_pkey" PRIMARY KEY ("id"), CONSTRAINT "recipe_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "recipe_feedback_userId_planRecipeId_idx" ON "recipe_feedback"("userId","planRecipeId");
