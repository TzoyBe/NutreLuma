-- Meal history & quick-pick: fingerprint column on meals + favorite_meals table.
-- Idempotent (IF NOT EXISTS) ώστε να είναι ασφαλές να ξανατρέξει.

ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "mealFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "meals_userId_mealFingerprint_idx" ON "meals"("userId", "mealFingerprint");

CREATE TABLE IF NOT EXISTS "favorite_meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT,
    "mealType" "MealType" NOT NULL,
    "calories" INTEGER,
    "proteinGrams" DECIMAL(7,2),
    "carbohydrateGrams" DECIMAL(7,2),
    "fatGrams" DECIMAL(7,2),
    "fiberGrams" DECIMAL(7,2),
    "sugarGrams" DECIMAL(7,2),
    "saturatedFatGrams" DECIMAL(7,2),
    "sodiumMg" INTEGER,
    "items" JSONB NOT NULL,
    "thumbKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "favorite_meals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "favorite_meals_userId_fingerprint_key" ON "favorite_meals"("userId", "fingerprint");
CREATE INDEX IF NOT EXISTS "favorite_meals_userId_idx" ON "favorite_meals"("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'favorite_meals_userId_fkey'
    ) THEN
        ALTER TABLE "favorite_meals" ADD CONSTRAINT "favorite_meals_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
