'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Προεπιλογή ο διαθέσιμος τρόπος· αν υπάρχουν και οι δύο, η κάρτα.
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
  }, [params, toast]);

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

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('billing.title')}</CardTitle>
          <CardDescription>
            {overview.accessUntilLabel ?? (locked ? t('billing.locked') : null)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge tone={locked ? 'danger' : 'primary'}>{overview.statusLabel}</Badge>

          {overview.kind !== 'UNLIMITED' ? (
            <>
              <p className="text-sm text-muted-foreground">
                {overview.autoRenew ? t('billing.autoRenewOn') : t('billing.autoRenewOff')}
              </p>

              {overview.autoRenew ? (
                <Button variant="outline" onClick={() => setConfirming(true)} disabled={loading}>
                  {t('billing.cancel')}
                </Button>
              ) : anyMethodAvailable ? (
                <div className="space-y-4">
                  {bothMethodsAvailable ? (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">{t('billing.chooseMethod')}</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            { value: 'card', label: t('billing.methodCard') },
                            { value: 'paypal', label: t('billing.methodPaypal') },
                          ] as const
                        ).map((option) => (
                          <label
                            key={option.value}
                            className={`flex cursor-pointer items-center gap-2 rounded-[--radius] border px-3 py-2.5 text-sm transition-colors ${
                              method === option.value
                                ? 'border-primary bg-primary/10 font-medium text-primary'
                                : 'border-border hover:bg-muted'
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
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  {showCard ? (
                    <Button onClick={subscribe} loading={loading} block>
                      {t('billing.subscribe', { price: overview.priceLabel })}
                    </Button>
                  ) : null}

                  {showPaypal ? (
                    <PayPalButton
                      clientId={overview.paypalClientId!}
                      planId={overview.paypalPlanId!}
                      userId={overview.userId}
                      onActivated={() => router.refresh()}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('billing.noMethodAvailable')}</p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('billing.paymentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.payments.length === 0 ? (
            <EmptyState title={t('billing.paymentsEmpty')} />
          ) : (
            <ul className="divide-y divide-border">
              {overview.payments.map((payment) => (
                <li key={payment.id} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm">{payment.paidAtLabel}</p>
                    {payment.note ? (
                      <p className="truncate text-xs text-muted-foreground">{payment.note}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{payment.amountLabel}</span>
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
