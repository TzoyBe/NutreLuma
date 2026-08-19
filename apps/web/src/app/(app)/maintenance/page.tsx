import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import {
  getEligibility,
  getMaintenanceDashboard,
  getTrends,
  getWeeklyReport,
  listAlerts,
} from '@/server/services/maintenance';
import { getActiveGoalMode, listModeHistory } from '@/server/services/goal-mode';
import { getT } from '@/i18n/locale';
import { MaintenanceClient } from '@/components/maintenance/maintenance-client';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('maintenance.navTitle') };
}

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const [eligibility, mode] = await Promise.all([
    getEligibility(user.id),
    getActiveGoalMode(user.id),
  ]);

  const active = mode.mode === 'MAINTENANCE';
  const [dashboard, trends, report, alerts, modeHistory] = active
    ? await Promise.all([
        getMaintenanceDashboard(user.id),
        getTrends(user.id),
        getWeeklyReport(user.id),
        listAlerts(user.id),
        listModeHistory(user.id),
      ])
    : [null, null, null, [], await listModeHistory(user.id)];

  return (
    <MaintenanceClient
      eligibility={eligibility}
      mode={mode.mode}
      dashboard={dashboard}
      trends={trends}
      report={report}
      alerts={alerts}
      modeHistory={modeHistory}
    />
  );
}
