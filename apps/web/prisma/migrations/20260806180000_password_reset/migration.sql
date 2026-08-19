-- Επαναφορά κωδικού μέσω email.
--
-- Καθαρά προσθετικό: μία nullable στήλη και ένας νέος πίνακας. Καμία υπάρχουσα
-- γραμμή δεν μεταβάλλεται και καμία στήλη δεν διαγράφεται.

-- Κάθε JWT που εκδόθηκε πριν από αυτή τη στιγμή θεωρείται άκυρο. Μένει NULL για
-- τους υπάρχοντες χρήστες, ώστε οι τρέχουσες συνεδρίες τους να μη διακοπούν.
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE "password_reset_tokens" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    -- SHA-256 του token, ποτέ το ίδιο το token.
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key"
    ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
