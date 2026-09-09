-- Admin account moderation (lock/soft-delete) and a standalone audit trail.
ALTER TABLE "users"
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockReason" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TYPE "AuditEventType" AS ENUM (
  'LOGIN',
  'PASSWORD_CHANGE',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'ACCESS_EXPIRED',
  'ACCOUNT_SOFT_DELETED',
  'ACCOUNT_HARD_DELETED'
);

-- Intentionally no FK to "users": an ACCOUNT_HARD_DELETED row must survive
-- the cascade delete of the user it describes.
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailSnapshot" TEXT NOT NULL,
  "type" "AuditEventType" NOT NULL,
  "metadata" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
