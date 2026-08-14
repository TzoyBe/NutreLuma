import { NextResponse } from 'next/server';
import { verifyEmailToken } from '@/server/services/email-verification';
import { env } from '@/server/env';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const redirectUrl = new URL('/verify-email', env.APP_URL);

  try {
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
      throw new Error('invalid token shape');
    }
    await verifyEmailToken(token);
    redirectUrl.searchParams.set('status', 'success');
  } catch (error) {
    logger.warn('email_verification_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    redirectUrl.searchParams.set('status', 'failed');
  }

  return NextResponse.redirect(redirectUrl);
}
