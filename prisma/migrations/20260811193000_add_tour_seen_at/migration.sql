-- Welcome tour "seen" marker on the user.
-- Idempotent & non-destructive: add nullable column only if it does not exist.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tourSeenAt" TIMESTAMP(3);
