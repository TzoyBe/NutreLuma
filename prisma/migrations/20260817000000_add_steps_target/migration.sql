-- Add an optional daily steps target to nutrition goals.
ALTER TABLE "nutrition_goals"
ADD COLUMN "stepsTarget" INTEGER;
