'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, CheckCircle2, CreditCard, WalletCards } from 'lucide-react';
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
  stripeAvailable: boolean;
  paypalAvailable: boolean;
  paypalClientId: string | null;
  paypalPlanId: string | null;
  userId: string;
  payments: Array<{ id: string; amountLabel: string; paidAtLabel: string; note: string | null }>;
}

type PaymentMethod = 'card' | 'paypal';

export function BillingPanel({ overview }: { overview: BillingOverviewView }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
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
      const { url } = await api.post<{ url: string }>('/api/billing/stripe/checkout');
      window.location.href = url;
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
      setLoading(false);
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
  const paypalReady =
    overview.paypalAvailable && Boolean(overview.paypalClientId && overview.paypalPlanId);
  const anyMethodAvailable = overview.stripeAvailable || paypalReady;
  const bothMethodsAvailable = overview.stripeAvailable && paypalReady;
  const showCard = overview.stripeAvailable && (!bothMethodsAvailable || method === 'card');
  const showPaypal = paypalReady && (!bothMethodsAvailable || method === 'paypal');
  const isUnlimited = overview.kind === 'UNLIMITED';

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            {isUnlimited ? (
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {overview.statusLabel}
              </p>
            ) : (
              <p className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                  {overview.priceLabel}
                </span>
                <span className="text-sm text-muted-foreground">{t('billing.perMonth')}</span>
              </p>
            )}
            <Badge tone={locked ? 'danger' : 'primary'}>{overview.statusLabel}</Badge>
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
        <Card className="overflow-hidden" solid>
          <CardContent className="space-y-5">
            {bothMethodsAvailable ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t('billing.chooseMethod')}</legend>
                <div className="glass-subtle grid gap-1 rounded-[1.3rem] p-1 sm:grid-cols-2">
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
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
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

            {showCard ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('billing.cardCheckout')}</p>
                <Button onClick={subscribe} loading={loading} className="sm:min-w-[14rem]">
                  {t('billing.subscribe', { price: overview.priceLabel })}
                </Button>
              </div>
            ) : null}

            {showPaypal ? (
              <PayPalButton
                clientId={overview.paypalClientId!}
                planId={overview.paypalPlanId!}
                userId={overview.userId}
                onActivated={() => router.refresh()}
              />
            ) : null}

            {!anyMethodAvailable ? (
              <p className="text-sm text-muted-foreground">{t('billing.noMethodAvailable')}</p>
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
