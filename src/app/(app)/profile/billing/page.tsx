import type { Metadata } from 'next';
import { Suspense } from 'react';
import { requirePageUser } from '@/server/auth/guards';
import { getBillingOverview } from '@/server/services/subscription';
import { getUserTimezone } from '@/server/services/profile';
import { formatDateInTz } from '@/lib/dates';
import { BillingPanel } from '@/components/billing/billing-panel';
import { Skeleton } from '@/components/ui/misc';
import { getT } from '@/i18n/locale';
import type { TranslationKey } from '@/i18n';
import type { AccessStateKind } from '@/lib/billing/access';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('billing.title') };
}
export const dynamic = 'force-dynamic';

const STATUS_KEY: Record<AccessStateKind, TranslationKey> = {
  TRIAL: 'billing.statusTrial',
  ACTIVE: 'billing.statusActive',
  GRACE: 'billing.statusGrace',
  LOCKED: 'billing.statusLocked',
  UNLIMITED: 'billing.statusUnlimited',
};

export default async function ProfileBillingPage() {
  const t = await getT();
  const user = await requirePageUser();
  const [overview, timezone] = await Promise.all([
    getBillingOverview(user.id),
    getUserTimezone(user.id),
  ]);

  const euro = (cents: number) => `${(cents / 100).toFixed(2)}€`;

  return (
    <>
      <p className="text-sm text-muted-foreground">{t('billing.subtitle')}</p>

      <Suspense fallback={<Skeleton className="h-64" />}>
        <BillingPanel
          overview={{
            kind: overview.state.kind,
            statusLabel: t(STATUS_KEY[overview.state.kind]),
            accessUntilLabel: overview.state.accessUntil
              ? t('billing.activeUntil', {
                  date: formatDateInTz(overview.state.accessUntil, timezone),
                })
              : null,
            autoRenew: overview.state.autoRenew,
            priceLabel: euro(overview.priceCents),
            stripeAvailable: overview.stripeAvailable,
            paypalAvailable: overview.paypalAvailable,
            paypalClientId: overview.paypalClientId,
            paypalPlanId: overview.paypalPlanId,
            userId: user.id,
            payments: overview.payments.map((payment) => ({
              id: payment.id,
              amountLabel: euro(payment.amountCents),
              paidAtLabel: formatDateInTz(new Date(payment.paidAt), timezone),
              note: payment.note,
            })),
          }}
        />
      </Suspense>
    </>
  );
}
