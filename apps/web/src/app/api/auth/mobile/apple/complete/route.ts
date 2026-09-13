import { ApiError, jsonOk, withErrorHandling } from '@/server/http';
import { createSessionToken } from '@/server/auth/session';
import { verifyAppleIdentityToken } from '@/server/auth/apple';
import { findOrCreateUserFromApple } from '@/server/services/user';
import { assertAccountActive, recordAuditEvent } from '@/server/services/audit';
import { prisma } from '@/server/db/prisma';
import { env } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  const body = (await request.json().catch(() => ({}))) as {
    identityToken?: unknown;
    fullName?: unknown;
  };
  const identityToken = typeof body.identityToken === 'string' ? body.identityToken : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName : null;

  if (!identityToken) {
    throw new ApiError('UNAUTHENTICATED', 'Apple sign-in could not be completed.');
  }

  const profile = await verifyAppleIdentityToken(identityToken, fullName);
  const user = await findOrCreateUserFromApple(profile);
  assertAccountActive(user);

  const hasProfile = await prisma.healthProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  await recordAuditEvent(prisma, {
    userId: user.id,
    email: user.email,
    type: 'LOGIN',
    metadata: { via: 'apple', appMode: 'native' },
  });

  const token = await createSessionToken({ sub: user.id, email: user.email, role: user.role });

  return jsonOk({
    token,
    expiresInDays: env.SESSION_MAX_AGE_DAYS,
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    needsProfile: !hasProfile,
  });
});
