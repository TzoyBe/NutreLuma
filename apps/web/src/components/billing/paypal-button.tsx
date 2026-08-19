'use client';

import * as React from 'react';
import { api, ApiClientError } from '@/lib/api-client';
import { useToast } from '@/components/toast';
import { Skeleton } from '@/components/ui/misc';
import { useT } from '@/i18n/client';

/**
 * Ελάχιστο τμήμα του PayPal JS SDK που χρησιμοποιούμε πραγματικά.
 * Το SDK δεν έχει επίσημους τύπους στο npm χωρίς επιπλέον εξάρτηση, οπότε
 * δηλώνουμε μόνο ό,τι καλούμε — τίποτα δεν είναι `any`.
 */
interface PayPalActions {
  subscription: { create(options: { plan_id: string; custom_id: string }): Promise<string> };
}

interface PayPalButtonsConfig {
  style?: {
    shape?: string;
    color?: string;
    layout?: string;
    label?: string;
    height?: number;
    borderRadius?: number;
    tagline?: boolean;
    disableMaxWidth?: boolean;
  };
  createSubscription(data: unknown, actions: PayPalActions): Promise<string>;
  onApprove(data: { subscriptionID?: string | null }): void | Promise<void>;
  onError?(error: unknown): void;
  onCancel?(): void;
}

interface PayPalSdk {
  Buttons(config: PayPalButtonsConfig): {
    render(container: HTMLElement): Promise<void>;
    close?(): void;
  };
}

declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

const SCRIPT_ID = 'paypal-sdk';

/** Φορτώνει το SDK μία φορά ανά σελίδα και το επαναχρησιμοποιεί. */
function loadSdk(clientId: string): Promise<PayPalSdk> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.paypal) return Promise.resolve(window.paypal);

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  const script = existing ?? document.createElement('script');

  const promise = new Promise<PayPalSdk>((resolve, reject) => {
    script.addEventListener('load', () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error('PayPal SDK loaded without global'));
    });
    script.addEventListener('error', () => reject(new Error('PayPal SDK failed to load')));
  });

  if (!existing) {
    const url = new URL('https://www.paypal.com/sdk/js');
    url.searchParams.set('client-id', clientId);
    url.searchParams.set('vault', 'true');
    url.searchParams.set('intent', 'subscription');
    url.searchParams.set('currency', 'EUR');
    url.searchParams.set('disable-funding', 'venmo');
    script.id = SCRIPT_ID;
    script.src = url.toString();
    script.async = true;
    document.body.appendChild(script);
  }

  return promise;
}

export function PayPalButton({
  clientId,
  planId,
  userId,
  onActivated,
}: {
  clientId: string;
  planId: string;
  /** Ταξιδεύει ως `custom_id` και επαληθεύεται server-side στο confirm. */
  userId: string;
  onActivated: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Οι callbacks μπαίνουν σε ref: το SDK κρατά την πρώτη έκδοση της config για
  // πάντα, οπότε χωρίς αυτό θα καλούσε παλιά closure μετά από re-render.
  const handlers = React.useRef({ onActivated, toast, t });
  handlers.current = { onActivated, toast, t };

  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    loadSdk(clientId)
      .then((sdk) => {
        if (cancelled) return;
        const buttons = sdk.Buttons({
          style: {
            shape: 'pill',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe',
            borderRadius: 999,
            tagline: false,
            height: 50,
            disableMaxWidth: true,
          },
          createSubscription: (_data, actions) =>
            actions.subscription.create({ plan_id: planId, custom_id: userId }),
          onApprove: async (data) => {
            const subscriptionId = data.subscriptionID;
            if (!subscriptionId) {
              handlers.current.toast.push(handlers.current.t('billing.verifyFailed'), 'error');
              return;
            }
            try {
              // Το id ΔΕΝ δίνει από μόνο του πρόσβαση: ο server ρωτά την PayPal.
              await api.post('/api/billing/paypal/confirm', { subscriptionId });
              handlers.current.toast.push(handlers.current.t('billing.activated'), 'success');
              handlers.current.onActivated();
            } catch (error) {
              handlers.current.toast.push(
                error instanceof ApiClientError
                  ? error.message
                  : handlers.current.t('billing.verifyFailed'),
                'error',
              );
            }
          },
          onError: () => {
            handlers.current.toast.push(handlers.current.t('billing.paypalFailed'), 'error');
          },
        });
        return buttons.render(container).then(() => {
          if (!cancelled) setReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [clientId, planId, userId]);

  if (failed) {
    return <p className="text-sm text-destructive">{t('billing.paypalFailed')}</p>;
  }

  return (
    <div className="w-full">
      {ready ? null : <Skeleton className="h-12 w-full rounded-full" />}
      <div ref={containerRef} />
    </div>
  );
}
