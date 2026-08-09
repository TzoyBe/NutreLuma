'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';
import type { QuickPickRef } from './quick-pick-types';

/** Κοινό κουμπί αγαπημένου — optimistic star toggle, χρησιμοποιείται παντού. */
export function FavoriteToggle({
  refInput,
  initialFavorite,
  initialFavoriteId = null,
  className,
}: {
  refInput: QuickPickRef;
  initialFavorite: boolean;
  initialFavoriteId?: string | null;
  className?: string;
}) {
  const t = useT();
  const toast = useToast();
  const [isFav, setIsFav] = React.useState(initialFavorite);
  const [favoriteId, setFavoriteId] = React.useState<string | null>(initialFavoriteId);
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (isFav) {
        let id = favoriteId;
        if (!id) {
          const added = await api.post<{ favorite: { id: string } }>('/api/meals/favorites', {
            ref: refInput,
          });
          id = added.favorite.id;
        }
        await api.delete(`/api/meals/favorites/${id}`);
        setIsFav(false);
        setFavoriteId(null);
        toast.push(t('addMeal.removeFavorite'), 'success');
      } else {
        const added = await api.post<{ favorite: { id: string } }>('/api/meals/favorites', {
          ref: refInput,
        });
        setFavoriteId(added.favorite.id);
        setIsFav(true);
        toast.push(t('addMeal.saveFavorite'), 'success');
      }
    } catch (error) {
      toast.push(error instanceof ApiClientError ? error.message : t('errors.generic'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={isFav ? t('addMeal.removeFavorite') : t('addMeal.saveFavorite')}
      aria-pressed={isFav}
      className={
        className ??
        'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50'
      }
    >
      <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden="true" />
    </button>
  );
}
