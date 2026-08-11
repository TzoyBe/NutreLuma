'use client';

import * as React from 'react';
import { api, ApiClientError } from '@/lib/api-client';
import { localizeAchievement } from '@/lib/achievement-localization';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { BadgeIcon } from '@/components/goals/badge-icon';

type UnlockNotification = {
  id: string;
  type: 'ACHIEVEMENT_UNLOCKED' | 'BADGE_UNLOCKED' | string;
  title: string;
  body: string;
  dedupeKey: string | null;
  readAt: string | null;
};

type Badge = {
  code: string;
  name: string;
  description: string;
  iconKey: string;
  tier: string;
  unlocked: boolean;
};

type Achievement = {
  code: string;
  name: string;
  description: string;
  icon: string;
  badgeCode: string;
  unlocked: boolean;
};

type CelebrationItem = {
  notificationId: string;
  kind: 'achievement' | 'badge';
  title: string;
  body: string;
  achievement?: Achievement;
  badge?: Badge;
};

function celebrationUnlockKey(item: CelebrationItem) {
  const badgeCode = item.badge?.code ?? item.achievement?.badgeCode;
  return badgeCode ? `unlock:${badgeCode}` : `notification:${item.notificationId}`;
}

function dedupeCelebrations(items: CelebrationItem[]) {
  const byKey = new Map<string, CelebrationItem>();
  for (const item of items) {
    const key = celebrationUnlockKey(item);
    const existing = byKey.get(key);
    if (!existing || item.kind === 'badge') byKey.set(key, item);
  }
  return [...byKey.values()];
}

const STORAGE_KEY = 'nutreluma:celebrated-unlocks';

function loadCelebratedNotifications(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function storeCelebratedNotification(id: string) {
  if (typeof window === 'undefined') return;
  const current = new Set(loadCelebratedNotifications());
  current.add(id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...current].slice(-80)));
}

function isIgnoredError(error: unknown) {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

export function UnlockCelebrationProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const english = t('achievements.achievements') === 'Achievements';
  const [queue, setQueue] = React.useState<CelebrationItem[]>([]);
  const [active, setActive] = React.useState<CelebrationItem | null>(null);
  const queuedIds = React.useRef(new Set<string>());
  const loadingRef = React.useRef(false);
  const knownNotificationIds = React.useRef(new Set<string>());
  const initializedRef = React.useRef(false);

  const pollUnlocks = React.useCallback(async () => {
    if (loadingRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    loadingRef.current = true;
    try {
      const [{ achievements }, { badges }, { notifications }] = await Promise.all([
        api.get<{ achievements: Achievement[] }>('/api/achievements'),
        api.get<{ badges: Badge[] }>('/api/badges'),
        api.get<{ notifications: UnlockNotification[]; unreadCount: number }>(
          '/api/notifications?unreadOnly=true&limit=20',
        ),
      ]);

      const celebratedIds = new Set(loadCelebratedNotifications());
      const knownIds = knownNotificationIds.current;
      const isInitialSnapshot = !initializedRef.current;
      const nextItems = notifications
        .filter(
          (notification) =>
            !notification.readAt &&
            (notification.type === 'ACHIEVEMENT_UNLOCKED' || notification.type === 'BADGE_UNLOCKED') &&
            !isInitialSnapshot &&
            !knownIds.has(notification.id) &&
            !celebratedIds.has(notification.id) &&
            !queuedIds.current.has(notification.id),
        )
        .map((notification) => {
          const achievementCode = notification.dedupeKey?.startsWith('achievement:')
            ? notification.dedupeKey.slice('achievement:'.length)
            : notification.dedupeKey?.startsWith('badge:')
              ? notification.dedupeKey.slice('badge:'.length).replace(/^BADGE_/, '')
              : undefined;
          const achievement = achievementCode
            ? achievements.find((item) => item.code === achievementCode)
            : undefined;
          const badgeCode = notification.dedupeKey?.startsWith('badge:')
            ? notification.dedupeKey.slice('badge:'.length)
            : achievement?.badgeCode;

          return {
            notificationId: notification.id,
            kind: notification.type === 'BADGE_UNLOCKED' ? 'badge' : 'achievement',
            title: notification.title,
            body: notification.body,
            achievement,
            badge: badgeCode ? badges.find((item) => item.code === badgeCode) : undefined,
          } satisfies CelebrationItem;
        });

      if (nextItems.length > 0) {
        const deduped = dedupeCelebrations(nextItems);
        deduped.forEach((item) => queuedIds.current.add(item.notificationId));
        setQueue((current) => [...current, ...deduped]);
      }
      notifications.forEach((notification) => knownIds.add(notification.id));
      initializedRef.current = true;
    } catch (error) {
      if (!isIgnoredError(error)) {
        // Silent best-effort polling; user-facing errors would be noisy here.
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    void pollUnlocks();

    const interval = window.setInterval(() => {
      void pollUnlocks();
    }, 5000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void pollUnlocks();
    };
    const onFocus = () => void pollUnlocks();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollUnlocks]);

  React.useEffect(() => {
    if (active || queue.length === 0) return;
    setActive(queue[0]);
    setQueue((current) => current.slice(1));
  }, [active, queue]);

  const dismiss = React.useCallback(async (notificationId: string) => {
    storeCelebratedNotification(notificationId);
    queuedIds.current.delete(notificationId);
    setActive(null);
    try {
      await api.post('/api/notifications/read', { ids: [notificationId] });
    } catch {
      // Best effort only; the celebration should not get stuck on a read-sync failure.
    }
  }, []);

  return (
    <>
      {children}
      {active ? (
        <UnlockCelebrationModal
          celebration={active}
          english={english}
          onClose={() => void dismiss(active.notificationId)}
        />
      ) : null}
    </>
  );
}

function UnlockCelebrationModal({
  celebration,
  english,
  onClose,
}: {
  celebration: CelebrationItem;
  english: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const localizedAchievement = celebration.achievement
    ? localizeAchievement(celebration.achievement, english)
    : undefined;
  const title = localizedAchievement?.name ?? celebration.badge?.name ?? celebration.title;
  const body = localizedAchievement?.description ?? celebration.badge?.description ?? celebration.body;
  const iconKey = celebration.badge?.iconKey ?? localizedAchievement?.icon ?? celebration.achievement?.icon;
  const tier = celebration.badge?.tier;
  const primaryLabel =
    celebration.kind === 'badge' ? t('achievements.badgeUnlocked') : t('achievements.achievementUnlocked');

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-background/72 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-achievement-celebration-title"
      onClick={onClose}
    >
      <div
        className="glass glass-specular achievement-celebration-shell w-full max-w-md animate-fade-in rounded-[2rem] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="achievement-confetti" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="relative mx-auto mb-5 grid h-36 w-36 place-items-center">
          <span className="absolute inset-4 rounded-full border border-primary/18" />
          <span className="absolute inset-0 rounded-full bg-primary/12 blur-3xl" />
          <span className="achievement-radiance absolute inset-2 rounded-full" />
          <span className="absolute left-4 top-5 h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
          <span className="absolute right-5 top-8 h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="absolute bottom-6 left-7 h-2 w-2 animate-pulse rounded-full bg-primary/80" />
          <span className="absolute bottom-4 right-8 h-2.5 w-2.5 animate-pulse rounded-full bg-accent/90" />
          <BadgeIcon
            iconKey={iconKey}
            tier={tier}
            unlocked={true}
            size="lg"
            className="relative h-24 w-24 shadow-[0_0_40px_-18px_hsl(var(--primary)/0.95)]"
          />
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{primaryLabel}</p>
        <h2
          id="global-achievement-celebration-title"
          className="mt-3 text-2xl font-semibold tracking-tight text-foreground"
        >
          {t('achievements.congrats')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('achievements.congratsBody')}</p>

        <div className="glass-subtle mt-5 rounded-[1.75rem] p-5">
          <div className="flex items-center justify-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {primaryLabel}
            </span>
            {tier ? (
              <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                {tier}
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xl font-semibold text-foreground">{title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>

        <Button type="button" size="lg" block className="mt-6" onClick={onClose}>
          {t('achievements.nice')}
        </Button>
      </div>
    </div>
  );
}
