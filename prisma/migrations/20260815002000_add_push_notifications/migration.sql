-- Add push notification delivery tracking and Expo push tokens.
ALTER TABLE "notifications"
ADD COLUMN "pushedAt" TIMESTAMP(3);

CREATE TABLE "push_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT,
  "deviceName" TEXT,
  "disabledAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_userId_disabledAt_idx" ON "push_tokens"("userId", "disabledAt");

ALTER TABLE "push_tokens"
ADD CONSTRAINT "push_tokens_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
