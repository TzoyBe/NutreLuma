import 'server-only';
import { env } from '../env';

export interface BillingCouponPreview {
  code: string;
  valid: boolean;
  originalPriceCents: number;
  standardPriceCents: number;
  discountedPriceCents: number;
  couponDiscountPercent: number;
  paypalPlanId: string | null;
  stripePromotionCodeId: string | null;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function configuredCodes(): Set<string> {
  return new Set(
    env.SUBSCRIPTION_COUPON_CODES.split(',')
      .map(normalizeCode)
      .filter(Boolean),
  );
}

export function validateBillingCoupon(code: string): BillingCouponPreview {
  const normalized = normalizeCode(code);
  const valid = normalized.length > 0 && configuredCodes().has(normalized);

  return {
    code: normalized,
    valid,
    originalPriceCents: env.SUBSCRIPTION_ORIGINAL_PRICE_CENTS,
    standardPriceCents: env.SUBSCRIPTION_PRICE_CENTS,
    discountedPriceCents: env.SUBSCRIPTION_COUPON_PRICE_CENTS,
    couponDiscountPercent: 50,
    paypalPlanId: valid && env.PAYPAL_COUPON_PLAN_ID ? env.PAYPAL_COUPON_PLAN_ID : null,
    stripePromotionCodeId:
      valid && env.STRIPE_COUPON_PROMOTION_CODE_ID
        ? env.STRIPE_COUPON_PROMOTION_CODE_ID
        : null,
  };
}

export function isKnownBillingCoupon(code: string): boolean {
  return validateBillingCoupon(code).valid;
}
