import { z } from 'zod';
import { ApiError, assertSameOrigin, jsonOk, withErrorHandling } from '@/server/http';
import { requireApiUser } from '@/server/auth/guards';
import { validateBillingCoupon } from '@/server/billing/coupons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  await requireApiUser();

  const { code } = bodySchema.parse(await request.json());
  const coupon = validateBillingCoupon(code);

  if (!coupon.valid) {
    throw new ApiError('BAD_REQUEST', 'This coupon code is not valid.');
  }

  return jsonOk(coupon);
});
