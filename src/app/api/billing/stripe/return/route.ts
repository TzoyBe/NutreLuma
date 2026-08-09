import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { attachStripeCheckout } from '@/server/services/subscription';
import { env } from '@/server/env';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Το session_id έρχεται από το URL, άρα είναι είσοδος χρήστη.
 * Η attachStripeCheckout ρωτά το Stripe ποιανού είναι πριν ενεργοποιήσει.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await requireApiUser();
  const sessionId = new URL(request.url).searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(`${env.APP_URL}/billing?error=missing`);
  }

  try {
    await attachStripeCheckout(user.id, sessionId);
    return NextResponse.redirect(`${env.APP_URL}/billing?activated=1`);
  } catch (error) {
    logger.warn('stripe_return_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(`${env.APP_URL}/billing?error=verify`);
  }
});
