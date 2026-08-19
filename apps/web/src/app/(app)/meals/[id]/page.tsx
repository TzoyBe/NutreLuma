import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requirePageUser } from '@/server/auth/guards';
import { getMealForUser } from '@/server/services/meal';
import { getUserTimezone } from '@/server/services/profile';
import { ApiError } from '@/server/errors';
import { formatDateInTz, formatTimeInTz, utcToLocalDateTimeInput } from '@/lib/dates';
import { MealDetail } from '@/components/meal/meal-detail';
import { getT } from '@/i18n/locale';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('meal.resultTitle') };
}
export const dynamic = 'force-dynamic';

export default async function MealPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const user = await requirePageUser();
  const { id } = await params;

  let meal;
  try {
    meal = await getMealForUser(user.id, id);
  } catch (error) {
    // Το service πετάει NOT_FOUND και για γεύμα άλλου χρήστη (anti-IDOR).
    if (error instanceof ApiError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const timezone = await getUserTimezone(user.id);
  const analyzedAt = meal.aiAnalyzedAt ? new Date(meal.aiAnalyzedAt) : null;

  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t('common.back')}
      </Link>

      {/* Το key αναγκάζει remount μετά από νέα ανάλυση ή αποθήκευση, ώστε η
          φόρμα να ξαναδιαβάσει τα φρέσκα δεδομένα αντί για stale useState. */}
      <MealDetail
        key={meal.updatedAt}
        meal={{
          id: meal.id,
          mealType: meal.mealType,
          title: meal.title,
          notes: meal.notes,
          mealDateTimeLocal: utcToLocalDateTimeInput(new Date(meal.mealDateTime), timezone),
          status: meal.status,
          analysisStatus: meal.analysisStatus,
          aiEstimatedCalories: meal.aiEstimatedCalories,
          finalCalories: meal.finalCalories,
          aiMinCalories: meal.aiMinCalories,
          aiMaxCalories: meal.aiMaxCalories,
          aiConfidence: meal.aiConfidence,
          aiModel: meal.aiModel,
          aiProvider: meal.aiProvider,
          aiAnalyzedAtLabel: analyzedAt
            ? `${formatDateInTz(analyzedAt, timezone)} ${formatTimeInTz(analyzedAt, timezone)}`
            : null,
          aiErrorCode: meal.aiErrorCode,
          wasManuallyEdited: meal.wasManuallyEdited,
          imageUrl: meal.imageUrl,
          macros: meal.macros,
          items: meal.items,
          clarifications: meal.clarifications,
        }}
      />
    </>
  );
}
