import { NextResponse } from 'next/server';
import { buildGoogleAuthorizationUrl, sanitizeNextPath } from '@/server/auth/google';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url);
    const nextPath = sanitizeNextPath(url.searchParams.get('next'), '/dashboard');
    const destination = await buildGoogleAuthorizationUrl(nextPath);
    return NextResponse.redirect(destination);
  } catch (error) {
    logger.warn('google_auth_start_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(new URL('/login?oauthError=google_unavailable', request.url));
  }
};
