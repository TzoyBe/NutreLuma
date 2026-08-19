import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/server/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getT } from '@/i18n/locale';
import { WelcomeTour } from '@/components/onboarding/welcome-tour';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('tour.metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const user = await requirePageUser();
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tourSeenAt: true, displayName: true, healthProfile: { select: { id: true } } },
  });

  // Χωρίς προφίλ δεν έχει ολοκληρωθεί το onboarding· η ξενάγηση δείχνεται μία φορά.
  if (!record?.healthProfile) redirect('/onboarding');
  if (record.tourSeenAt) redirect('/dashboard');

  return <WelcomeTour firstName={record.displayName} />;
}
