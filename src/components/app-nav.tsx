'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChefHat, LayoutDashboard, LineChart, LogOut, Target, UserCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ACHIEVEMENTS, BADGES, badgeCodeFor } from '@/lib/achievements-catalog';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LogoMark } from '@/components/brand/logo';

const LINKS = [
  { href: '/dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard, match: ['/dashboard'] },
  {
    href: '/progress',
    labelKey: 'nav.progress',
    Icon: LineChart,
    match: ['/progress', '/history', '/stats', '/insights', '/weight'],
  },
  { href: '/goals', labelKey: 'nav.goals', Icon: Target, match: ['/goals', '/maintenance'] },
  { href: '/recipes', labelKey: 'recipes.navTitle', Icon: ChefHat, match: ['/recipes', '/meal-plan'] },
  {
    href: '/profile',
    labelKey: 'profile.title',
    Icon: UserCircle2,
    match: ['/profile', '/settings', '/billing', '/admin'],
  },
] as const;

type NavNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  milestoneId?: string | null;
  dedupeKey: string | null;
  readAt: string | null;
};

function notificationKey(notification: NavNotification) {
  if (notification.dedupeKey) return notification.dedupeKey;
  return `notification:${notification.id}`;
}

function notificationHref(notification: NavNotification) {
  if (notification.type === 'ACHIEVEMENT_UNLOCKED') return '/goals/achievements#achievements';
  if (notification.type === 'BADGE_UNLOCKED') return '/goals/achievements#badges';
  if (
    notification.type === 'MILESTONE_PROGRESS' ||
    notification.type === 'MILESTONE_COMPLETED' ||
    notification.type === 'MILESTONE_MISSED'
  ) {
    return notification.milestoneId
      ? `/goals/achievements#milestone-${notification.milestoneId}`
      : '/goals/achievements#milestones';
  }
  return '/goals/achievements';
}

function notificationDisplay(notification: NavNotification) {
  if (notification.type === 'ACHIEVEMENT_UNLOCKED') {
    const achievementCode = notification.dedupeKey?.startsWith('achievement:')
      ? notification.dedupeKey.slice('achievement:'.length)
      : null;
    const achievement = ACHIEVEMENTS.find((item) => item.code === achievementCode);
    if (achievement) {
      return {
        title: achievement.name,
        body: achievement.description,
      };
    }
  }

  if (notification.type === 'BADGE_UNLOCKED') {
    const badgeCode = notification.dedupeKey?.startsWith('badge:')
      ? notification.dedupeKey.slice('badge:'.length)
      : null;
    const badge =
      BADGES.find((item) => item.code === badgeCode) ??
      BADGES.find((item) => item.code === (badgeCode ? badgeCodeFor(badgeCode) : ''));
    if (badge) {
      return {
        title: badge.name,
        body: badge.description,
      };
    }
  }

  if (notification.type === 'MILESTONE_PROGRESS') {
    const thresholdMatch = notification.dedupeKey?.match(/progress:(\d+)$/);
    const threshold = thresholdMatch ? thresholdMatch[1] : null;
    return {
      title: notification.title,
      body: threshold
        ? `You reached ${threshold}% of this milestone.`
        : 'You made progress on this milestone.',
    };
  }

  if (notification.type === 'MILESTONE_COMPLETED') {
    return {
      title: notification.title,
      body: 'This milestone is complete.',
    };
  }

  if (notification.type === 'MILESTONE_MISSED') {
    return {
      title: notification.title,
      body: 'This milestone expired before completion. You can always try a lighter next goal.',
    };
  }

  return {
    title: notification.title,
    body: notification.body,
  };
}

export function AppNav({ displayName }: { displayName: string }) {
  const t = useT();
  const links = LINKS.map((link) => ({ ...link, label: t(link.labelKey) }));
  const pathname = usePathname();
  const router = useRouter();
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [notifications, setNotifications] = React.useState<NavNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [markingRead, setMarkingRead] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const visibleNotifications = React.useMemo(
    () =>
      notifications.filter(
        (notification, index, all) =>
          all.findIndex((candidate) => notificationKey(candidate) === notificationKey(notification)) ===
          index,
      ),
    [notifications],
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadNotifications = async (withList = false) => {
      try {
        const result = await api.get<{ notifications: NavNotification[]; unreadCount: number }>(
          `/api/notifications?limit=${withList ? 8 : 1}`,
        );
        if (cancelled) return;
        setUnreadNotifications(result.unreadCount ?? 0);
        if (withList) setNotifications(result.notifications ?? []);
      } catch {
        if (cancelled) return;
        setUnreadNotifications(0);
        if (withList) setNotifications([]);
      }
    };

    void loadNotifications(false);
    const interval = window.setInterval(() => void loadNotifications(false), 45000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (!notificationsOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notificationsOpen]);

  const openNotifications = async () => {
    setNotificationsOpen((current) => !current);
    if (notificationsOpen) return;

    setNotificationsLoading(true);
    try {
      const result = await api.get<{ notifications: NavNotification[]; unreadCount: number }>(
        '/api/notifications?limit=8',
      );
      setNotifications(result.notifications ?? []);
      setUnreadNotifications(result.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setUnreadNotifications(0);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markAllNotificationsRead = async () => {
    if (markingRead || visibleNotifications.length === 0) return;

    setMarkingRead(true);
    try {
      await api.post('/api/notifications/read');
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadNotifications(0);
    } finally {
      setMarkingRead(false);
    }
  };

  const openNotification = async (notification: NavNotification) => {
    if (!notification.readAt) {
      try {
        await api.post('/api/notifications/read', { ids: [notification.id] });
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          ),
        );
        setUnreadNotifications((current) => Math.max(0, current - 1));
      } catch {
        // no-op: navigation should still proceed
      }
    }

    setNotificationsOpen(false);
    router.push(notificationHref(notification));
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.post('/api/auth/logout');
      router.replace('/login');
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  const isActive = (match: readonly string[]) =>
    match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <>
      <header className="pointer-events-none sticky top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="container px-0">
          <div className="liquid-top-nav pointer-events-auto flex min-h-16 items-center gap-2 px-2.5 py-2">
            <Link
              href="/dashboard"
              className="liquid-brand flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/12 py-1.5 pl-1.5 pr-3 shadow-[0_14px_30px_-24px_hsl(var(--glass-shadow)/0.72)]"
              aria-label={t('app.name')}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.18),transparent_58%),linear-gradient(180deg,hsl(205_32%_12%),hsl(205_30%_9%))] shadow-[0_1px_0_hsl(var(--glass-border)/0.24)_inset,0_0_24px_-14px_hsl(var(--primary)/0.72)]">
                <LogoMark className="h-7 w-7 drop-shadow-[0_0_10px_hsl(var(--primary)/0.22)]" />
              </span>
              <span className="hidden min-w-0 font-semibold tracking-tight text-white/95 xs:block">
                {t('app.name')}
              </span>
            </Link>

            <nav aria-label={t('nav.menu')} className="mx-auto hidden items-center gap-1 md:flex">
              {links.map(({ href, label, Icon, match }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(match) ? 'page' : undefined}
                  data-active={isActive(match) ? 'true' : undefined}
                  className={cn(
                    'liquid-nav-link flex h-11 items-center gap-2 px-3.5 text-sm font-semibold transition-[background-color,color,transform] duration-200',
                    isActive(match)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className="liquid-nav-icon grid h-7 w-7 place-items-center rounded-full">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
              <span className="hidden max-w-[9rem] truncate rounded-full px-3 py-2 text-sm text-muted-foreground xl:inline">
                {displayName}
              </span>
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => void openNotifications()}
                  className="liquid-icon-button relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-200 hover:text-foreground active:scale-95"
                  aria-label={t('achievements.notifications')}
                  aria-haspopup="dialog"
                  aria-expanded={notificationsOpen}
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-[0_0_18px_-6px_hsl(var(--primary)/0.95)]">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {notificationsOpen ? (
                  <div className="glass glass-specular absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.6rem]">
                    <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {t('achievements.notifications')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {unreadNotifications} {t('achievements.new')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        disabled={markingRead || unreadNotifications === 0}
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-primary transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('achievements.markRead')}
                      </button>
                    </div>

                    <div className="max-h-[24rem] overflow-y-auto p-2">
                      {notificationsLoading ? (
                        <div className="space-y-2 p-2">
                          {[0, 1, 2].map((item) => (
                            <div key={item} className="skeleton h-16 rounded-2xl" />
                          ))}
                        </div>
                      ) : visibleNotifications.length === 0 ? (
                        <p className="rounded-2xl px-4 py-6 text-sm text-muted-foreground">
                          {t('achievements.noNotifications')}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {visibleNotifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => void openNotification(notification)}
                              className={cn(
                                'block w-full rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-white/5',
                                notification.readAt
                                  ? 'border-white/8 bg-black/10'
                                  : 'border-primary/20 bg-primary/10',
                              )}
                            >
                              {(() => {
                                const display = notificationDisplay(notification);
                                return (
                              <div className="flex items-start gap-3">
                                <span
                                  className={cn(
                                    'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full',
                                    notification.readAt
                                      ? 'bg-white/6 text-muted-foreground'
                                      : 'bg-primary/16 text-primary',
                                  )}
                                >
                                  <Bell className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    {display.title}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {display.body}
                                  </p>
                                </div>
                              </div>
                                );
                              })()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="liquid-icon-button grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-[background-color,color,transform] duration-200 hover:text-foreground active:scale-95"
                aria-label={t('nav.logout')}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <nav aria-label={t('nav.menu')} className="liquid-mobile-nav pointer-events-auto mx-auto max-w-md">
          <ul className="grid grid-cols-5 gap-1 p-1.5">
            {links.map(({ href, label, Icon, match }) => (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  aria-current={isActive(match) ? 'page' : undefined}
                  data-active={isActive(match) ? 'true' : undefined}
                  className={cn(
                    'liquid-nav-link flex min-h-[3.7rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold leading-none transition-[background-color,color,transform] duration-200',
                    isActive(match) ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className="liquid-nav-icon grid h-8 w-8 place-items-center rounded-full">
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  </span>
                  <span className="w-full truncate text-center">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('auth.logoutConfirm')}
        confirmLabel={t('nav.logout')}
        loading={loading}
        onConfirm={logout}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
