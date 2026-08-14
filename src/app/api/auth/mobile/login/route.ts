import { ApiError, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertLoginRateLimit } from '@/server/auth/rate-limit';
import { fakeVerify, verifyPassword } from '@/server/auth/password';
import { createSessionToken } from '@/server/auth/session';
import { findUserByEmail } from '@/server/services/user';
import { prisma } from '@/server/db/prisma';
import { loginSchema } from '@/lib/validation/auth';
import { logger } from '@/server/logger';
import { env } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json();
  const input = loginSchema.parse(body);

  await assertLoginRateLimit(clientIp(request), input.email);

  const user = await findUserByEmail(input.email);
  if (!user) {
    await fakeVerify();
    throw new ApiError('UNAUTHENTICATED', 'Wrong email or password.');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    logger.warn('mobile_login_failed', { userId: user.id });
    throw new ApiError('UNAUTHENTICATED', 'Wrong email or password.');
  }

  if (!user.emailVerifiedAt) {
    logger.warn('mobile_login_unverified_email', { userId: user.id });
    throw new ApiError(
      'FORBIDDEN',
      'Please verify your email before logging in. Check your inbox or request a new verification link.',
    );
  }

  const profile = await prisma.healthProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const token = await createSessionToken({ sub: user.id, email: user.email, role: user.role });

  logger.info('mobile_login_success', { userId: user.id });

  return jsonOk({
    token,
    expiresInDays: env.SESSION_MAX_AGE_DAYS,
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    needsProfile: !profile,
  });
});
