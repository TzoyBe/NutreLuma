import { NextResponse } from 'next/server';
import { buildGoogleAuthorizationUrl, sanitizeNextPath } from '@/server/auth/google';
import { env, isProduction } from '@/server/env';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requestedOrigin(request: Request, url: URL): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host') || url.host;
  const protocol = forwardedProto || url.protocol.replace(':', '');
  return `${protocol}://${host}`;
}

export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url);
    const origin = requestedOrigin(request, url).replace(/\/+$/, '');
    const canonicalOrigin = env.APP_URL.replace(/\/+$/, '');
    const nextPath = sanitizeNextPath(url.searchParams.get('next'), '/dashboard');
    if (isProduction && origin !== canonicalOrigin) {
      const canonicalUrl = new URL('/api/auth/google', canonicalOrigin);
      if (nextPath !== '/dashboard') canonicalUrl.searchParams.set('next', nextPath);
      return NextResponse.redirect(canonicalUrl);
    }

    const destination = await buildGoogleAuthorizationUrl(isProduction ? canonicalOrigin : origin, nextPath);
    return NextResponse.redirect(destination);
  } catch (error) {
    logger.warn('google_auth_start_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(new URL('/login?oauthError=google_unavailable', request.url));
  }
};
