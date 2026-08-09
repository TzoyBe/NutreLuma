import { ApiError, assertSameOrigin, clientIp, jsonOk, withErrorHandling } from '@/server/http';
import { assertLoginRateLimit } from '@/server/auth/rate-limit';
import { fakeVerify, verifyPassword } from '@/server/auth/password';
import { setSessionCookie } from '@/server/auth/session';
import { findUserByEmail } from '@/server/services/user';
import { prisma } from '@/server/db/prisma';
import { loginSchema } from '@/lib/validation/auth';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);

  const body = await request.json();
  const input = loginSchema.parse(body);

  assertLoginRateLimit(clientIp(request), input.email);

  const user = await findUserByEmail(input.email);
  if (!user) {
    // Ίδιος χρόνος απόκρισης με υπαρκτό χρήστη (anti user-enumeration).
    await fakeVerify();
    throw new ApiError('UNAUTHENTICATED', 'Λάθος email ή κωδικός.');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    logger.warn('login_failed', { userId: user.id });
    throw new ApiError('UNAUTHENTICATED', 'Λάθος email ή κωδικός.');
  }

  await setSessionCookie({ sub: user.id, email: user.email, role: user.role });
  logger.info('login_success', { userId: user.id });

  const profile = await prisma.healthProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  return jsonOk({ id: user.id, displayName: user.displayName, needsProfile: !profile });
});
