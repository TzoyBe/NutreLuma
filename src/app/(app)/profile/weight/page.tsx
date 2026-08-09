import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { listWeightEntries } from '@/server/services/weight';
import { todayISO } from '@/lib/dates';
import { WeightPanel } from '@/components/weight/weight-panel';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('weight.title') };
}
export const dynamic = 'force-dynamic';

export default async function ProfileWeightPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  const entries = await listWeightEntries(user.id, { limit: 180 });

  return (
    <>
      <p className="text-sm text-muted-foreground">{t('weight.subtitle')}</p>

      <WeightPanel
        entries={entries.map((entry) => ({
          id: entry.id,
          weightKg: entry.weightKg,
          entryDate: entry.entryDate,
          notes: entry.notes,
        }))}
        todayISO={todayISO(profile.timezone)}
        targetWeightKg={profile.targetWeightKg}
      />
    </>
  );
}
