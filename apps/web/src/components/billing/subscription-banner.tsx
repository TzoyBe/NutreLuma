import Link from 'next/link';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getT } from '@/i18n/locale';
import type { AccessStateKind } from '@/lib/billing/access';

export async function SubscriptionBanner({
  kind,
  daysRemaining,
  accessUntilLabel,
}: {
  kind: AccessStateKind;
  daysRemaining: number | null;
  accessUntilLabel: string | null;
}) {
  const t = await getT();
  // Ενεργή συνδρομή και ADMIN δεν χρειάζονται υπενθύμιση.
  if (kind === 'UNLIMITED' || kind === 'ACTIVE') return null;

  const locked = kind === 'LOCKED';
  const message =
    kind === 'TRIAL'
      ? daysRemaining !== null && daysRemaining <= 1
        ? t('billing.trialLastDay')
        : t('billing.trialActive', { days: String(daysRemaining ?? 0) })
      : kind === 'GRACE'
        ? t('billing.graceNotice')
        : t('billing.locked');

  return (
    <div
      role={locked ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        locked ? 'border-destructive/40 bg-destructive/10' : 'border-accent/40 bg-accent/10',
      )}
    >
      {locked ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {accessUntilLabel && !locked ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{accessUntilLabel}</p>
        ) : null}
      </div>
      <Link
        href="/profile/billing"
        className="shrink-0 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
      >
        {t('billing.navLabel')}
      </Link>
    </div>
  );
}
