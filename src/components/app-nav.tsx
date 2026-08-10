'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChefHat, LayoutDashboard, LineChart, LogOut, Target, UserCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';
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

export function AppNav({ displayName }: { displayName: string }) {
  const t = useT();
  const links = LINKS.map((link) => ({ ...link, label: t(link.labelKey) }));
  const pathname = usePathname();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

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
              className="liquid-brand flex min-w-0 shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
              aria-label={t('app.name')}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 shadow-[0_1px_0_hsl(var(--glass-border)/0.55)_inset]">
                <LogoMark className="h-7 w-7" />
              </span>
              <span className="hidden min-w-0 font-semibold tracking-tight xs:block">
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
