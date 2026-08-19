import { NextResponse } from 'next/server';
import { sanitizeNextPath } from '@/server/auth/google';
import { setSessionCookie, verifyMobileAuthHandoffToken } from '@/server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const verified = await verifyMobileAuthHandoffToken(token);
  if (!verified) {
    return NextResponse.redirect(new URL('/login?oauthError=google_failed', url));
  }

  await setSessionCookie({
    sub: verified.sub,
    email: verified.email,
    role: verified.role,
  });

  const destination = sanitizeNextPath(verified.nextPath, '/dashboard');
  return NextResponse.redirect(new URL(destination, url));
};
