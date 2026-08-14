import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { validateBillingCoupon } from '@/server/billing/coupons';
import { createCheckoutSession } from '@/server/billing/stripe';
import { env, stripeConfigured, stripeYearlyConfigured } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireApiUser();
  const body = (await request.json().catch(() => ({}))) as {
    couponCode?: unknown;
    interval?: unknown;
  };
  const couponCode = typeof body.couponCode === 'string' ? body.couponCode : '';
  const interval = body.interval === 'yearly' ? 'yearly' : 'monthly';
  const coupon = couponCode ? validateBillingCoupon(couponCode) : null;

  if (couponCode && !coupon?.valid) {
    throw new ApiError('BAD_REQUEST', 'This coupon code is not valid.');
  }
  if (coupon?.valid && !coupon.stripePromotionCodeId) {
    throw new ApiError('BAD_REQUEST', 'Coupon checkout is not configured for card payments.');
  }

  if (interval === 'yearly' && !stripeYearlyConfigured) {
    throw new ApiError('BAD_REQUEST', 'Yearly card checkout is not configured.');
  }

  if (interval === 'monthly' && !stripeConfigured) {
    throw new ApiError('BAD_REQUEST', 'Η πληρωμή με κάρτα δεν είναι διαθέσιμη αυτή τη στιγμή.');
  }

  const { url } = await createCheckoutSession(
    user.id,
    `${env.APP_URL}/api/billing/stripe/return`,
    `${env.APP_URL}/billing?cancelled=1`,
    coupon?.stripePromotionCodeId ?? null,
    interval === 'yearly' ? env.STRIPE_YEARLY_PRICE_ID : env.STRIPE_PRICE_ID,
  );

  return jsonOk({ url });
});
