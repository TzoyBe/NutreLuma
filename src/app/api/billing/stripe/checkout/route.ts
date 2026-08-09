import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { createCheckoutSession } from '@/server/billing/stripe';
import { env, stripeConfigured } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();

  if (!stripeConfigured) {
    throw new ApiError('BAD_REQUEST', 'Η πληρωμή με κάρτα δεν είναι διαθέσιμη αυτή τη στιγμή.');
  }

  const { url } = await createCheckoutSession(
    user.id,
    `${env.APP_URL}/api/billing/stripe/return`,
    `${env.APP_URL}/billing?cancelled=1`,
  );

  return jsonOk({ url });
});
