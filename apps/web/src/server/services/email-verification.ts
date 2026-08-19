import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';
import { env } from '../env';
import { logger } from '../logger';
import { ApiError } from '../errors';
import { sendEmail } from '../email';
import { buildEmailVerificationEmail } from '../email/templates';
import type { Locale } from '@/i18n';

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function sendEmailVerification(userId: string, locale: Locale): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, emailVerifiedAt: true },
  });

  if (!user) throw new ApiError('NOT_FOUND', 'Account not found.');
  if (user.emailVerifiedAt) return true;

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });
  });

  const verifyUrl = `${env.APP_URL.replace(/\/+$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail(
    buildEmailVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verifyUrl,
      expiresInHours: env.EMAIL_VERIFICATION_TTL_HOURS,
      locale,
    }),
  );

  logger.info('email_verification_sent', { userId: user.id, emailSent: sent });
  return sent;
}

export async function resendEmailVerification(email: string, locale: Locale): Promise<{ accepted: true }> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, emailVerifiedAt: true },
  });

  if (!user || user.emailVerifiedAt) {
    logger.info('email_verification_resend_noop');
    return { accepted: true };
  }

  await sendEmailVerification(user.id, locale);
  return { accepted: true };
}

export async function verifyEmailToken(token: string): Promise<void> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  const invalid = new ApiError(
    'BAD_REQUEST',
    'The verification link is invalid or has expired. Request a new one.',
  );

  if (!record) throw invalid;
  if (record.usedAt) throw invalid;
  if (record.expiresAt.getTime() <= Date.now()) throw invalid;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: now },
    });
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
    await tx.emailVerificationToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
  });

  logger.info('email_verified', { userId: record.userId });
}
