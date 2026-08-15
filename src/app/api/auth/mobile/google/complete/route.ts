import { ApiError, jsonOk, withErrorHandling } from '@/server/http';
import { createSessionToken, verifyMobileAuthHandoffToken } from '@/server/auth/session';
import { prisma } from '@/server/db/prisma';
import { env } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const handoffToken = typeof body.token === 'string' ? body.token : '';
  const verified = await verifyMobileAuthHandoffToken(handoffToken);

  if (!verified) {
    throw new ApiError('UNAUTHENTICATED', 'Google sign-in could not be completed.');
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.sub },
    select: { id: true, email: true, displayName: true, role: true, healthProfile: { select: { id: true } } },
  });

  if (!user) {
    throw new ApiError('UNAUTHENTICATED', 'Google sign-in could not be completed.');
  }

  const token = await createSessionToken({ sub: user.id, email: user.email, role: user.role });

  return jsonOk({
    token,
    expiresInDays: env.SESSION_MAX_AGE_DAYS,
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    needsProfile: !user.healthProfile,
  });
});
