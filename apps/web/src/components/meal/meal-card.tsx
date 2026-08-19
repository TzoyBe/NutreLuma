'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Utensils } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { Badge } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

export interface MealCardData {
  id: string;
  title: string;
  mealTypeLabel: string;
  timeLabel: string;
  dateLabel?: string;
  calories: number | null;
  thumbUrl: string | null;
  analysisStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  wasManuallyEdited: boolean;
}

export function MealCard({ meal }: { meal: MealCardData }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await api.delete(`/api/meals/${meal.id}`);
      toast.push(t('toast.mealDeleted'), 'success');
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <article className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {meal.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meal.thumbUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Utensils className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {meal.dateLabel ? `${meal.dateLabel} · ` : ''}
              {meal.timeLabel} · {meal.mealTypeLabel}
            </span>
            {meal.analysisStatus === 'FAILED' ? (
              <Badge tone="danger">{t('dashboard.failedBadge')}</Badge>
            ) : meal.analysisStatus === 'PENDING' ? (
              <Badge tone="muted">{t('dashboard.pendingBadge')}</Badge>
            ) : (
              <Badge tone={meal.wasManuallyEdited ? 'accent' : 'primary'}>
                {meal.wasManuallyEdited ? t('dashboard.editedBadge') : t('dashboard.aiBadge')}
              </Badge>
            )}
          </div>
          <Link
            href={`/meals/${meal.id}`}
            className="mt-0.5 block truncate font-medium hover:underline"
          >
            {meal.title}
          </Link>
          <p className="tabular-nums text-sm text-muted-foreground">
            {meal.calories === null ? '—' : `${meal.calories} kcal`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/meals/${meal.id}`}
            aria-label={`${t('common.edit')}: ${meal.title}`}
            className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirming(true)}
            aria-label={`${t('common.delete')}: ${meal.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </article>

      <ConfirmDialog
        open={confirming}
        title={t('meal.deleteConfirmTitle')}
        body={t('meal.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
