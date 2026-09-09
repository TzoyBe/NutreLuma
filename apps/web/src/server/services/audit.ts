import 'server-only';
import type { AuditEventType, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function recordAuditEvent(
  db: DbClient,
  params: {
    userId: string;
    email: string;
    type: AuditEventType;
    metadata?: Record<string, unknown>;
    actorId?: string;
  },
) {
  await db.auditLog.create({
    data: {
      userId: params.userId,
      emailSnapshot: params.email,
      type: params.type,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      actorId: params.actorId,
    },
  });
}

/** Πετάει FORBIDDEN αν ο λογαριασμός είναι locked (admin suspension) ή soft-deleted. */
export function assertAccountActive(user: { lockedAt?: Date | null; deletedAt?: Date | null }) {
  if (user.deletedAt) {
    throw new ApiError('FORBIDDEN', 'This account no longer exists.');
  }
  if (user.lockedAt) {
    throw new ApiError('FORBIDDEN', 'This account has been suspended. Contact support.');
  }
}
