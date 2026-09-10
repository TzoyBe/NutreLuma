import { NextResponse } from 'next/server';
import { buildGoogleAuthorizationUrl, sanitizeNextPath } from '@/server/auth/google';
import { env, isProduction } from '@/server/env';
import { logger } from '@/server/logger';
import { resolveGoogleOauthOrigin } from '@/server/auth/google-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const publicOrigin = resolveGoogleOauthOrigin(request, env.APP_URL, isProduction);
  const nextPath = sanitizeNextPath(url.searchParams.get('next'), '/dashboard');
  const appMode = url.searchParams.get('app') === 'capacitor' ? 'capacitor' : 'web';

  try {
    const canonicalOrigin = env.APP_URL.replace(/\/+$/, '');
    const requestOrigin = resolveGoogleOauthOrigin(request, env.APP_URL, false);
    if (isProduction && requestOrigin !== canonicalOrigin) {
      const canonicalUrl = new URL('/api/auth/google', canonicalOrigin);
      if (nextPath !== '/dashboard') canonicalUrl.searchParams.set('next', nextPath);
      if (appMode === 'capacitor') canonicalUrl.searchParams.set('app', 'capacitor');
      return NextResponse.redirect(canonicalUrl);
    }

    const destination = await buildGoogleAuthorizationUrl(
      publicOrigin,
      nextPath,
      appMode,
    );
    return NextResponse.redirect(destination);
  } catch (error) {
    logger.warn('google_auth_start_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    if (appMode === 'capacitor') {
      return NextResponse.redirect('nutreluma://auth/callback?error=google_unavailable');
    }
    return NextResponse.redirect(new URL('/login?oauthError=google_unavailable', publicOrigin));
  }
};
