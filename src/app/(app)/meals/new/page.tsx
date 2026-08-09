import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getProfile } from '@/server/services/profile';
import { env } from '@/server/env';
import { MealUploadForm } from '@/components/meal/meal-upload-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meal.newTitle') };
}
export const dynamic = 'force-dynamic';

export default async function NewMealPage() {
  const t = await getT();
  const user = await requirePageUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect('/onboarding');

  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t('common.back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('meal.newTitle')}</CardTitle>
          <CardDescription>{t('meal.newSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <MealUploadForm maxUploadMb={env.MAX_UPLOAD_SIZE_MB} />
        </CardContent>
      </Card>
    </>
  );
}
