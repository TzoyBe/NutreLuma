import Link from 'next/link';
import { getEligibility } from '@/server/services/maintenance';
import { getActiveGoalMode } from '@/server/services/goal-mode';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
import { getT } from '@/i18n/locale';

/**
 * Σημείο εισόδου συντήρησης στο dashboard. Εμφανίζεται πάντα διακριτικά:
 *  - κλειδωμένο με πρόοδο πριν την επίτευξη στόχου,
 *  - πρόσκληση ενεργοποίησης όταν ξεκλειδώσει,
 *  - σύνδεσμος στον πίνακα όταν είναι ενεργό.
 * Δεν παρουσιάζεται ως τιμωρία ή τέλος προσπάθειας.
 */
export async function MaintenanceDashboardCard({ userId }: { userId: string }) {
  const t = await getT();
  const [eligibility, mode] = await Promise.all([
    getEligibility(userId),
    getActiveGoalMode(userId),
  ]);

  const active = mode.mode === 'MAINTENANCE';
  const eligible = eligibility.eligible && !active;

  // Χωρίς στόχο βάρους δεν δείχνουμε τίποτα — δεν έχει νόημα ακόμη.
  if (!active && eligibility.targetWeightKg === null) return null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{t('maintenance.lockedTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {active
                ? t('maintenance.dashboardTitle')
                : eligible
                  ? t('maintenance.unlockedBody')
                  : t('maintenance.lockedBody')}
            </p>
          </div>
          <Link href="/maintenance" className="shrink-0 text-sm font-medium text-primary hover:underline">
            {active ? t('common.open') : eligible ? t('maintenance.activate') : t('common.view')}
          </Link>
        </div>
        {!active ? (
          <Progress
            value={eligibility.progressPercent}
            max={100}
            label={t('maintenance.unlockProgress')}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
