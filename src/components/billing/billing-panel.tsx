'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Receipt,
  Tag,
  WalletCards,
} from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, EmptyState } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PayPalButton } from '@/components/billing/paypal-button';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import type { AccessStateKind } from '@/lib/billing/access';

export interface BillingOverviewView {
  kind: AccessStateKind;
  statusLabel: string;
  accessUntilLabel: string | null;
  autoRenew: boolean;
  priceLabel: string;
  originalPriceLabel: string;
  discountLabel: string;
  couponPriceLabel: string;
  couponDiscountLabel: string;
  paypalCouponPlanId: string | null;
  yearlyPriceLabel: string;
  yearlyOriginalPriceLabel: string;
  yearlyDiscountLabel: string;
  stripeYearlyAvailable: boolean;
  paypalYearlyAvailable: boolean;
  paypalYearlyPlanId: string | null;
  stripeAvailable: boolean;
  paypalAvailable: boolean;
  paypalClientId: string | null;
  paypalPlanId: string | null;
  userId: string;
  payments: Array<{ id: string; amountLabel: string; paidAtLabel: string; note: string | null }>;
}

type PaymentMethod = 'card' | 'paypal';
type BillingInterval = 'monthly' | 'yearly';

export function BillingPanel({ overview }: { overview: BillingOverviewView }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [couponInput, setCouponInput] = React.useState('');
  const [couponCode, setCouponCode] = React.useState<string | null>(null);
  const [couponApplying, setCouponApplying] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [interval, setInterval] = React.useState<BillingInterval>('monthly');
  const notified = React.useRef(false);
  const [method, setMethod] = React.useState<PaymentMethod>(
    overview.stripeAvailable ? 'card' : 'paypal',
  );

  React.useEffect(() => {
    if (notified.current) return;
    if (params.get('activated')) {
      toast.push(t('billing.activated'), 'success');
      notified.current = true;
    } else if (params.get('error')) {
      toast.push(t('billing.verifyFailed'), 'error');
      notified.current = true;
    }
  }, [params, t, toast]);

  async function subscribe() {
    if (loading) return;
    setLoading(true);
    try {
      const { url } = await api.post<{ url: string }>('/api/billing/stripe/checkout', {
        couponCode: interval === 'yearly' ? null : couponCode,
        interval,
      });
      window.location.href = url;
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      setLoading(false);
    }
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponApplying) return;
    setCouponApplying(true);
    try {
      const coupon = await api.post<{ code: string }>('/api/billing/coupon', { code });
      setCouponCode(coupon.code);
      setCouponInput(coupon.code);
      toast.push(t('billing.couponApplied'), 'success');
    } catch (error) {
      setCouponCode(null);
      toast.push(error instanceof ApiClientError ? error.message : t('billing.couponInvalid'), 'error');
    } finally {
      setCouponApplying(false);
    }
  }

  async function cancel() {
    setLoading(true);
    try {
      await api.post('/api/billing/cancel');
      toast.push(t('billing.cancelled'), 'success');
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  const locked = overview.kind === 'LOCKED';
  const yearlySelected = interval === 'yearly';
  const paypalReady =
    overview.paypalAvailable && Boolean(overview.paypalClientId && overview.paypalPlanId);
  const yearlyPaypalReady =
    overview.paypalYearlyAvailable &&
    Boolean(overview.paypalClientId && overview.paypalYearlyPlanId);
  const cardAvailable = yearlySelected ? overview.stripeYearlyAvailable : overview.stripeAvailable;
  const paypalAvailableForInterval = yearlySelected ? yearlyPaypalReady : paypalReady;
  const anyMethodAvailable = cardAvailable || paypalAvailableForInterval;
  const bothMethodsAvailable = cardAvailable && paypalAvailableForInterval;
  const showCard = cardAvailable && (!bothMethodsAvailable || method === 'card');
  const showPaypal =
    paypalAvailableForInterval && (!bothMethodsAvailable || method === 'paypal');
  const isUnlimited = overview.kind === 'UNLIMITED';
  const discountedByCoupon = Boolean(couponCode) && !yearlySelected;
  const checkoutPriceLabel = yearlySelected
    ? overview.yearlyPriceLabel
    : discountedByCoupon
      ? overview.couponPriceLabel
      : overview.priceLabel;
  const originalPriceLabel = yearlySelected
    ? overview.yearlyOriginalPriceLabel
    : overview.originalPriceLabel;
  const discountLabel = yearlySelected ? overview.yearlyDiscountLabel : overview.discountLabel;
  const selectedPayPalPlanId = yearlySelected
    ? overview.paypalYearlyPlanId
    : discountedByCoupon && overview.paypalCouponPlanId
      ? overview.paypalCouponPlanId
      : overview.paypalPlanId;
  const intervalSuffix = yearlySelected ? t('billing.perYear') : t('billing.perMonth');

  React.useEffect(() => {
    if (method === 'card' && !cardAvailable && paypalAvailableForInterval) setMethod('paypal');
    if (method === 'paypal' && !paypalAvailableForInterval && cardAvailable) setMethod('card');
  }, [cardAvailable, method, paypalAvailableForInterval]);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t('billing.currentSubscription')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Receipt className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {overview.statusLabel}
                </p>
                <Badge tone={locked ? 'danger' : 'primary'}>{overview.statusLabel}</Badge>
              </div>
            </div>

            {!isUnlimited ? (
              <div className="min-w-[11rem] space-y-2 sm:text-right">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t('billing.monthlyCost')}
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className="text-base font-medium tabular-nums text-muted-foreground line-through">
                    {originalPriceLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                    <BadgePercent className="h-3.5 w-3.5" aria-hidden="true" />
                    {discountLabel}
                  </span>
                </div>
                <p className="flex items-baseline gap-1.5 sm:justify-end">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                    {checkoutPriceLabel}
                  </span>
                  <span className="text-sm text-muted-foreground">{intervalSuffix}</span>
                </p>
                {yearlySelected ? (
                  <p className="text-xs font-medium text-primary">{t('billing.yearlyPromo')}</p>
                ) : null}
                {discountedByCoupon ? (
                  <p className="text-xs text-primary">
                    {t('billing.couponDiscount', { discount: overview.couponDiscountLabel })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {overview.accessUntilLabel || !isUnlimited ? (
            <div className="space-y-2.5 border-t border-border/60 pt-4 text-sm">
              {overview.accessUntilLabel ? (
                <div className="flex items-center gap-2.5 text-foreground">
                  <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{overview.accessUntilLabel}</span>
                </div>
              ) : null}
              {!isUnlimited ? (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {overview.autoRenew ? t('billing.autoRenewOn') : t('billing.autoRenewOff')}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {overview.autoRenew && !isUnlimited ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(true)}
                disabled={loading}
              >
                {t('billing.cancel')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!isUnlimited ? (
        <Card
          solid
          className="overflow-hidden !border-black/5 !bg-white text-neutral-900 !shadow-[0_12px_34px_-20px_rgba(0,0,0,0.5)]"
        >
          <CardContent className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-neutral-700">
                {t('billing.chooseInterval')}
              </legend>
              <div className="grid gap-1 rounded-[1.3rem] bg-neutral-100 p-1 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'monthly',
                      label: t('billing.intervalMonthly'),
                      detail: `${overview.priceLabel}${t('billing.perMonth')}`,
                    },
                    {
                      value: 'yearly',
                      label: t('billing.intervalYearly'),
                      detail: `${overview.yearlyPriceLabel}${t('billing.perYear')}`,
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-[1rem] px-3 py-3 text-sm transition-colors ${
                      interval === option.value
                        ? 'bg-primary font-medium text-primary-foreground shadow-[0_16px_28px_-18px_hsl(var(--primary)/0.95)]'
                        : 'text-neutral-500 hover:bg-black/5 hover:text-neutral-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingInterval"
                      className="sr-only"
                      value={option.value}
                      checked={interval === option.value}
                      onChange={() => {
                        setInterval(option.value);
                        setCouponCode(null);
                      }}
                    />
                    <span>{option.label}</span>
                    <span className="text-xs opacity-80">{option.detail}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {bothMethodsAvailable ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-neutral-700">
                  {t('billing.chooseMethod')}
                </legend>
                <div className="grid gap-1 rounded-[1.3rem] bg-neutral-100 p-1 sm:grid-cols-2">
                  {(
                    [
                      { value: 'card', label: t('billing.methodCard'), Icon: CreditCard },
                      { value: 'paypal', label: t('billing.methodPaypal'), Icon: WalletCards },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-[1rem] px-3 py-3 text-sm transition-colors ${
                        method === option.value
                          ? 'bg-primary font-medium text-primary-foreground shadow-[0_16px_28px_-18px_hsl(var(--primary)/0.95)]'
                          : 'text-neutral-500 hover:bg-black/5 hover:text-neutral-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        className="sr-only"
                        value={option.value}
                        checked={method === option.value}
                        onChange={() => setMethod(option.value)}
                      />
                      <option.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {!yearlySelected ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700" htmlFor="billing-coupon">
                {t('billing.couponCode')}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Tag
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden="true"
                  />
                  <input
                    id="billing-coupon"
                    value={couponInput}
                    onChange={(event) => {
                      setCouponInput(event.target.value.toUpperCase());
                      setCouponCode(null);
                    }}
                    placeholder={t('billing.couponPlaceholder')}
                    className="h-11 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm uppercase text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCoupon}
                  loading={couponApplying}
                  disabled={!couponInput.trim()}
                  className="!border-neutral-200 !bg-white !text-neutral-900 hover:!bg-neutral-50"
                >
                  {t('billing.applyCoupon')}
                </Button>
              </div>
              {discountedByCoupon ? (
                <p className="text-sm font-medium text-primary">
                  {t('billing.couponAppliedPrice', { price: overview.couponPriceLabel })}
                </p>
              ) : null}
            </div>
            ) : null}

            {showCard ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-500">{t('billing.cardCheckout')}</p>
                <Button onClick={subscribe} loading={loading} className="sm:min-w-[14rem]">
                  {t('billing.subscribe', { price: checkoutPriceLabel })}
                </Button>
              </div>
            ) : null}

            {showPaypal && selectedPayPalPlanId ? (
              <PayPalButton
                clientId={overview.paypalClientId!}
                planId={selectedPayPalPlanId}
                userId={overview.userId}
                onActivated={() => router.refresh()}
              />
            ) : null}

            <p className="text-xs leading-relaxed text-neutral-500">{t('billing.paymentTerms')}</p>

            {!anyMethodAvailable ? (
              <p className="text-sm text-neutral-500">{t('billing.noMethodAvailable')}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>{t('billing.paymentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.payments.length === 0 ? (
            <EmptyState title={t('billing.paymentsEmpty')} />
          ) : (
            <ul className="space-y-2">
              {overview.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{payment.paidAtLabel}</p>
                    {payment.note ? (
                      <p className="truncate text-xs text-muted-foreground">{payment.note}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                    {payment.amountLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        title={t('billing.cancelConfirmTitle')}
        body={t('billing.cancelConfirmBody')}
        confirmLabel={t('billing.cancel')}
        destructive
        loading={loading}
        onConfirm={cancel}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
