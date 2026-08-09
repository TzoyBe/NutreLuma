import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { logger } from '../logger';
import { ApiError } from '../errors';
import { hashPassword } from '../auth/password';
import { sendEmail } from '../email';
import { buildPasswordResetEmail } from '../email/templates';
import type { Locale } from '@/i18n';

/**
 * Επαναφορά κωδικού.
 *
 * ΑΡΧΕΣ ΑΣΦΑΛΕΙΑΣ ΠΟΥ ΕΠΙΒΑΛΛΟΝΤΑΙ ΕΔΩ:
 *
 * 1. Καμία αποκάλυψη ύπαρξης λογαριασμού. Η αίτηση επιστρέφει πάντα το ίδιο
 *    αποτέλεσμα, ανεξάρτητα από το αν το email υπάρχει — αλλιώς η φόρμα θα
 *    γινόταν εργαλείο απαρίθμησης πελατών.
 * 2. Στη βάση αποθηκεύεται μόνο το SHA-256 του token. Διαρροή της βάσης δεν
 *    επιτρέπει σε κανέναν να κατασκευάσει έγκυρο σύνδεσμο.
 * 3. Το token είναι μιας χρήσης και λήγει σύντομα.
 * 4. Νέα αίτηση ακυρώνει τις προηγούμενες εκκρεμείς.
 * 5. Μετά την επαναφορά ακυρώνονται ΟΛΕΣ οι ενεργές συνεδρίες.
 */

/** 32 τυχαία bytes: πρακτικά αδύνατο να μαντευτεί. */
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ResetRequestResult {
  /** Πάντα true προς τον client. Το πραγματικό αποτέλεσμα μένει στα logs. */
  accepted: true;
}

export async function requestPasswordReset(
  email: string,
  locale: Locale,
): Promise<ResetRequestResult> {
  const normalized = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, displayName: true },
  });

  if (!user) {
    // Σκόπιμα σιωπηλή επιτυχία: ο επισκέπτης δεν πρέπει να μάθει ότι το email
    // δεν αντιστοιχεί σε λογαριασμό.
    logger.info('password_reset_requested_unknown_email');
    return { accepted: true };
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    // Μια νέα αίτηση ακυρώνει τις προηγούμενες: αλλιώς θα έμεναν πολλοί
    // ενεργοί σύνδεσμοι ταυτόχρονα, αυξάνοντας άσκοπα την επιφάνεια επίθεσης.
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });
  });

  const resetUrl = `${env.APP_URL.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

  const sent = await sendEmail(
    buildPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      resetUrl,
      expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      locale,
    }),
  );

  logger.info('password_reset_requested', { userId: user.id, emailSent: sent });
  return { accepted: true };
}

/**
 * Ολοκληρώνει την επαναφορά.
 *
 * Το γενικό μήνυμα σφάλματος είναι σκόπιμο: δεν ξεχωρίζει «άγνωστο» από
 * «ληγμένο» ή «χρησιμοποιημένο» token.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  const invalid = new ApiError(
    'BAD_REQUEST',
    'Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος ή έχει λήξει. Ζήτησε νέο.',
  );

  if (!record) throw invalid;
  if (record.usedAt) throw invalid;
  if (record.expiresAt.getTime() <= Date.now()) throw invalid;

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      // Το `passwordChangedAt` ακυρώνει κάθε JWT που εκδόθηκε νωρίτερα: αν
      // κάποιος είχε κλέψει session cookie, χάνει την πρόσβαση εδώ.
      data: { passwordHash, passwordChangedAt: now },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
    // Τα υπόλοιπα εκκρεμή tokens του ίδιου χρήστη δεν έχουν πια νόημα.
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
  });

  logger.info('password_reset_completed', { userId: record.userId });
}

/**
 * Καθαρισμός ληγμένων tokens. Δεν είναι κρίσιμο για την ασφάλεια (τα ληγμένα
 * απορρίπτονται ούτως ή άλλως), αλλά κρατά τον πίνακα μικρό.
 */
export async function purgeExpiredResetTokens(): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
