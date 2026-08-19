CREATE TABLE "saved_recipes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mealType" "MealType" NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_recipes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_recipes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "saved_recipes_userId_fingerprint_key" ON "saved_recipes"("userId", "fingerprint");
CREATE INDEX "saved_recipes_userId_createdAt_idx" ON "saved_recipes"("userId", "createdAt");
