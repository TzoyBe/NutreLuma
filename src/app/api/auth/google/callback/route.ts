import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { resolveGoogleUserFromCallback, sanitizeNextPath } from '@/server/auth/google';
import { setSessionCookie } from '@/server/auth/session';
import { logger } from '@/server/logger';
import { findOrCreateUserFromGoogle } from '@/server/services/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const callbackUrl = new URL(request.url);

  try {
    const remoteError = callbackUrl.searchParams.get('error');
    if (remoteError) {
      return NextResponse.redirect(
        new URL(`/login?oauthError=${encodeURIComponent(remoteError)}`, callbackUrl),
      );
    }

    const { profile, nextPath } = await resolveGoogleUserFromCallback(callbackUrl.searchParams);
    const user = await findOrCreateUserFromGoogle(profile);
    await setSessionCookie({ sub: user.id, email: user.email, role: user.role });

    const hasProfile = await prisma.healthProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const destination = hasProfile ? sanitizeNextPath(nextPath) : '/onboarding';
    return NextResponse.redirect(new URL(destination, callbackUrl));
  } catch (error) {
    logger.warn('google_auth_callback_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(new URL('/login?oauthError=google_failed', callbackUrl));
  }
};
