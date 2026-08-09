-- Phase 1: αναλυτικά διατροφικά στοιχεία, draft flow, στόχοι με ιστορικό.
--
-- ΑΡΧΗ ΑΣΦΑΛΕΙΑΣ: καμία στήλη δεν διαγράφεται και κανένα υπάρχον δεδομένο δεν
-- μεταβάλλεται σημασιολογικά. Κάθε νέα στήλη μπαίνει nullable ή με default που
-- διατηρεί την τρέχουσα συμπεριφορά, και μετά γίνεται στοχευμένο backfill.

-- ---------------------------------------------------------------------------
-- 1. Νέοι τύποι
-- ---------------------------------------------------------------------------

CREATE TYPE "MealStatus" AS ENUM (
  'PENDING', 'ANALYZING', 'REVIEW_REQUIRED', 'CONFIRMED', 'FAILED', 'CANCELLED'
);

CREATE TYPE "MealSource" AS ENUM (
  'AI_IMAGE', 'MANUAL', 'BARCODE', 'NUTRITION_LABEL', 'SAVED_MEAL', 'RECIPE'
);

CREATE TYPE "GoalSource" AS ENUM ('AUTO', 'MANUAL');

-- ---------------------------------------------------------------------------
-- 2. Meal: κύκλος ζωής, προέλευση, εύρος θερμίδων, macros
-- ---------------------------------------------------------------------------

-- Το default 'CONFIRMED' είναι σκόπιμο: κάθε ΥΠΑΡΧΟΥΣΑ γραμμή παίρνει αμέσως
-- κατάσταση που συνεχίζει να μετρά στα ημερήσια σύνολα. Χωρίς αυτό, όλα τα
-- ιστορικά σύνολα θα μηδενίζονταν τη στιγμή που το app φιλτράρει σε CONFIRMED.
ALTER TABLE "meals" ADD COLUMN "status" "MealStatus" NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "meals" ADD COLUMN "source" "MealSource" NOT NULL DEFAULT 'AI_IMAGE';
ALTER TABLE "meals" ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TABLE "meals" ADD COLUMN "aiMinCalories" INTEGER;
ALTER TABLE "meals" ADD COLUMN "aiMaxCalories" INTEGER;

ALTER TABLE "meals" ADD COLUMN "proteinGrams" DECIMAL(7,2);
ALTER TABLE "meals" ADD COLUMN "carbohydrateGrams" DECIMAL(7,2);
ALTER TABLE "meals" ADD COLUMN "fatGrams" DECIMAL(7,2);
ALTER TABLE "meals" ADD COLUMN "fiberGrams" DECIMAL(7,2);
ALTER TABLE "meals" ADD COLUMN "sugarGrams" DECIMAL(7,2);
ALTER TABLE "meals" ADD COLUMN "saturatedFatGrams" DECIMAL(7,2);
ALTER TABLE "meals" ADD COLUMN "sodiumMg" INTEGER;

-- Backfill status. Σειρά σημαντική: πρώτα τα προβληματικά, μετά τα έγκυρα.
-- Οτιδήποτε έχει finalCalories ΠΡΕΠΕΙ να καταλήξει CONFIRMED.
UPDATE "meals"
   SET "status" = 'FAILED'
 WHERE "analysisStatus" = 'FAILED' AND "finalCalories" IS NULL;

UPDATE "meals"
   SET "status" = 'REVIEW_REQUIRED'
 WHERE "analysisStatus" = 'PENDING' AND "finalCalories" IS NULL;

UPDATE "meals"
   SET "status" = 'CONFIRMED', "confirmedAt" = "updatedAt"
 WHERE "finalCalories" IS NOT NULL;

-- Προέλευση: ό,τι έχει φωτογραφία προήλθε από ανάλυση εικόνας.
UPDATE "meals" SET "source" = 'MANUAL' WHERE "imagePath" IS NULL;

CREATE INDEX "meals_userId_status_mealDateTime_idx"
    ON "meals"("userId", "status", "mealDateTime");

-- ---------------------------------------------------------------------------
-- 3. MealItem: εύρος θερμίδων και macros ανά τρόφιμο
-- ---------------------------------------------------------------------------

ALTER TABLE "meal_items" ADD COLUMN "aiMinCalories" INTEGER;
ALTER TABLE "meal_items" ADD COLUMN "aiMaxCalories" INTEGER;

ALTER TABLE "meal_items" ADD COLUMN "proteinGrams" DECIMAL(7,2);
ALTER TABLE "meal_items" ADD COLUMN "carbohydrateGrams" DECIMAL(7,2);
ALTER TABLE "meal_items" ADD COLUMN "fatGrams" DECIMAL(7,2);
ALTER TABLE "meal_items" ADD COLUMN "fiberGrams" DECIMAL(7,2);
ALTER TABLE "meal_items" ADD COLUMN "sugarGrams" DECIMAL(7,2);
ALTER TABLE "meal_items" ADD COLUMN "saturatedFatGrams" DECIMAL(7,2);
ALTER TABLE "meal_items" ADD COLUMN "sodiumMg" INTEGER;

-- ---------------------------------------------------------------------------
-- 4. Διευκρινιστικές ερωτήσεις
-- ---------------------------------------------------------------------------

CREATE TABLE "meal_clarifications" (
    "id"         TEXT NOT NULL,
    "mealId"     TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "question"   TEXT NOT NULL,
    "options"    JSONB NOT NULL,
    "answer"     TEXT,
    "answeredAt" TIMESTAMP(3),
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meal_clarifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meal_clarifications_mealId_questionId_key"
    ON "meal_clarifications"("mealId", "questionId");
CREATE INDEX "meal_clarifications_mealId_idx" ON "meal_clarifications"("mealId");

ALTER TABLE "meal_clarifications"
  ADD CONSTRAINT "meal_clarifications_mealId_fkey"
  FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Ημερήσιοι στόχοι με ιστορικό
-- ---------------------------------------------------------------------------

CREATE TABLE "nutrition_goals" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "effectiveFrom"     DATE NOT NULL,
    "source"            "GoalSource" NOT NULL DEFAULT 'AUTO',
    "calorieTarget"     INTEGER NOT NULL,
    "proteinGrams"      DECIMAL(6,2),
    "carbohydrateGrams" DECIMAL(6,2),
    "fatGrams"          DECIMAL(6,2),
    "fiberGrams"        DECIMAL(6,2),
    "waterMl"           INTEGER,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrition_goals_userId_effectiveFrom_key"
    ON "nutrition_goals"("userId", "effectiveFrom");
CREATE INDEX "nutrition_goals_userId_effectiveFrom_idx"
    ON "nutrition_goals"("userId", "effectiveFrom");

ALTER TABLE "nutrition_goals"
  ADD CONSTRAINT "nutrition_goals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: ο υπάρχων στόχος του προφίλ γίνεται η πρώτη εγγραφή ιστορικού.
-- Το `effectiveFrom` πάει αρκετά πίσω ώστε να καλύπτει ΚΑΘΕ υπάρχον γεύμα —
-- αλλιώς παλιές ημέρες θα εμφανίζονταν ξαφνικά χωρίς στόχο.
INSERT INTO "nutrition_goals"
       ("id", "userId", "effectiveFrom", "source", "calorieTarget", "createdAt", "updatedAt")
SELECT
    'goal_seed_' || hp."userId",
    hp."userId",
    LEAST(
      hp."createdAt"::date,
      COALESCE((SELECT MIN(m."mealDateTime")::date FROM "meals" m WHERE m."userId" = hp."userId"),
               hp."createdAt"::date)
    ),
    'AUTO',
    hp."dailyCalorieTarget",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "health_profiles" hp
 WHERE hp."dailyCalorieTarget" IS NOT NULL;
