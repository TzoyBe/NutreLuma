import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { resolveGoogleUserFromCallback, sanitizeNextPath } from '@/server/auth/google';
import { createMobileAuthHandoffToken, setSessionCookie } from '@/server/auth/session';
import { env, isProduction } from '@/server/env';
import { logger } from '@/server/logger';
import { findOrCreateUserFromGoogle } from '@/server/services/user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAPACITOR_RETURN_SCHEME = 'nutreluma://auth/callback';

function requestedOrigin(request: Request, url: URL): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || url.host;
  const protocol = forwardedProto || url.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

export const GET = async (request: Request) => {
  const callbackUrl = new URL(request.url);
  const origin = requestedOrigin(request, callbackUrl).replace(/\/+$/, '');
  const publicOrigin = isProduction ? env.APP_URL.replace(/\/+$/, '') : origin;

  try {
    const remoteError = callbackUrl.searchParams.get('error');
    if (remoteError) {
      return NextResponse.redirect(
        new URL(`/login?oauthError=${encodeURIComponent(remoteError)}`, publicOrigin),
      );
    }

    const { profile, nextPath, appMode } = await resolveGoogleUserFromCallback(callbackUrl.searchParams);
    const user = await findOrCreateUserFromGoogle(profile);
    const hasProfile = await prisma.healthProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const destination = hasProfile ? sanitizeNextPath(nextPath) : '/onboarding';
    if (appMode === 'capacitor') {
      const token = await createMobileAuthHandoffToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        nextPath: destination,
      });
      const handoffUrl = new URL(CAPACITOR_RETURN_SCHEME);
      handoffUrl.searchParams.set('token', token);
      handoffUrl.searchParams.set('next', destination);
      return NextResponse.redirect(handoffUrl);
    }

    await setSessionCookie({ sub: user.id, email: user.email, role: user.role });
    return NextResponse.redirect(new URL(destination, publicOrigin));
  } catch (error) {
    logger.warn('google_auth_callback_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(new URL('/login?oauthError=google_failed', publicOrigin));
  }
};
