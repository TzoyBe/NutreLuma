import 'server-only';
import { prisma } from '../db/prisma';
import { ApiError } from '../errors';
import { recordAuditEvent } from './audit';

async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new ApiError('NOT_FOUND', 'Ο χρήστης δεν βρέθηκε.');
  return user;
}

export async function lockUser(userId: string, actorId: string, reason?: string): Promise<void> {
  const user = await loadUser(userId);
  if (user.role === 'ADMIN') throw new ApiError('FORBIDDEN', 'Δεν μπορείς να κλειδώσεις λογαριασμό admin.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { lockedAt: new Date(), lockReason: reason || null } });
    await recordAuditEvent(tx, { userId, email: user.email, type: 'ACCOUNT_LOCKED', actorId, metadata: reason ? { reason } : undefined });
  });
}

export async function unlockUser(userId: string, actorId: string): Promise<void> {
  const user = await loadUser(userId);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { lockedAt: null, lockReason: null } });
    await recordAuditEvent(tx, { userId, email: user.email, type: 'ACCOUNT_UNLOCKED', actorId });
  });
}

/** Τερματίζει άμεσα την πρόσβαση (συνδρομή) — ο χρήστης μπορεί ακόμη να κάνει login. */
export async function expireAccess(userId: string, actorId: string): Promise<void> {
  const user = await loadUser(userId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { userId },
      update: { status: 'EXPIRED', accessUntil: now, autoRenew: false },
      create: { userId, status: 'EXPIRED', accessUntil: now, autoRenew: false },
    });
    await recordAuditEvent(tx, { userId, email: user.email, type: 'ACCESS_EXPIRED', actorId });
  });
}

export async function softDeleteUser(userId: string, actorId: string): Promise<void> {
  const user = await loadUser(userId);
  if (user.role === 'ADMIN') throw new ApiError('FORBIDDEN', 'Δεν μπορείς να διαγράψεις λογαριασμό admin.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    await recordAuditEvent(tx, { userId, email: user.email, type: 'ACCOUNT_SOFT_DELETED', actorId });
  });
}

/**
 * Μόνιμη διαγραφή όλων των δεδομένων του χρήστη (π.χ. αίτημα GDPR).
 * Το audit log γράφεται ΠΡΩΤΑ — δεν έχει FK στο user, άρα επιζεί του cascade delete.
 */
export async function hardDeleteUser(userId: string, actorId: string, confirmEmail: string): Promise<void> {
  const user = await loadUser(userId);
  if (user.role === 'ADMIN') throw new ApiError('FORBIDDEN', 'Δεν μπορείς να διαγράψεις λογαριασμό admin.');
  if (user.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) {
    throw new ApiError('BAD_REQUEST', 'Το email επιβεβαίωσης δεν ταιριάζει.');
  }

  await recordAuditEvent(prisma, { userId, email: user.email, type: 'ACCOUNT_HARD_DELETED', actorId });
  await prisma.user.delete({ where: { id: userId } });
}
