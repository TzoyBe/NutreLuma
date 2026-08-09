import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../auth/password';
import { ApiError } from '../errors';
import { logger } from '../logger';
import { createTrialForUser } from './subscription';
import type { RegisterInput } from '@/lib/validation/auth';

export async function createUser(input: Omit<RegisterInput, 'passwordConfirm' | 'consent'>) {
  const passwordHash = await hashPassword(input.password);
  try {
    // Ένα transaction: δεν γίνεται να υπάρξει χρήστης χωρίς συνδρομή.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          consentAcceptedAt: new Date(),
        },
        select: { id: true, email: true, displayName: true, role: true },
      });
      await createTrialForUser(tx, created.id);
      return created;
    });
    logger.info('user_registered', { userId: user.id });
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError('CONFLICT', 'Υπάρχει ήδη λογαριασμός με αυτό το email.');
    }
    throw error;
  }
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, displayName: true, role: true, passwordHash: true },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new ApiError('UNAUTHENTICATED', 'Η συνεδρία δεν είναι έγκυρη.');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError('FORBIDDEN', 'Ο τρέχων κωδικός δεν είναι σωστός.');

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      // Το `passwordChangedAt` ακυρώνει κάθε ΑΛΛΗ ενεργή συνεδρία. Αν ο χρήστης
      // αλλάζει κωδικό επειδή υποπτεύεται παραβίαση, αυτό είναι ακριβώς το
      // αποτέλεσμα που περιμένει.
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    // Τυχόν εκκρεμείς σύνδεσμοι επαναφοράς δεν έχουν πια νόημα.
    await tx.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  });
  logger.info('user_password_changed', { userId });
}

export async function updateDisplayName(userId: string, displayName: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName },
    select: { id: true, displayName: true },
  });
}
