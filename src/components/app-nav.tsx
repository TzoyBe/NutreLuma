'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChefHat,
  LayoutDashboard,
  LineChart,
  LogOut,
  Target,
  UserCircle2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LogoMark } from '@/components/brand/logo';

/**
 * Πέντε ομαδοποιημένοι προορισμοί, ώστε το μενού να μένει απλό και το bottom
 * navigation του κινητού να χωρά σε μία σειρά με άνετα σημεία αφής:
 *  - Progress: History, Statistics, Insights, Weight (hub σελίδα με cards)
 *  - Goals:    Goals, Achievements, Maintenance
 *  - Profile:  Profile, Settings, Billing, Admin
 *
 * Οι ετικέτες προκύπτουν μέσα στο component, ώστε να αλλάζουν με τη γλώσσα.
 */
const LINKS = [
  { href: '/dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard, match: ['/dashboard'] },
  { href: '/progress', labelKey: 'nav.progress', Icon: LineChart, match: ['/progress', '/history', '/stats', '/insights', '/weight'] },
  { href: '/goals', labelKey: 'nav.goals', Icon: Target, match: ['/goals', '/maintenance'] },
  { href: '/recipes', labelKey: 'recipes.navTitle', Icon: ChefHat, match: ['/recipes', '/meal-plan'] },
  { href: '/profile', labelKey: 'profile.title', Icon: UserCircle2, match: ['/profile', '/settings', '/billing', '/admin'] },
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
      <header className="glass sticky top-0 z-30 rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="container flex h-14 items-center gap-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <LogoMark className="h-8 w-8" />
            {/* Το όνομα κρύβεται σε πολύ στενές οθόνες: το σήμα αρκεί. */}
            <span className="hidden font-semibold tracking-tight xs:inline">{t('app.name')}</span>
          </Link>

          <nav
            aria-label={t('nav.menu')}
            className="mx-auto hidden items-center gap-1 md:flex"
          >
            {links.map(({ href, label, Icon, match }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(match) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive(match)
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-[hsl(var(--glass-bg)/0.75)] hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <span className="hidden max-w-[9rem] truncate text-sm text-muted-foreground xl:inline">
              {displayName}
            </span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[hsl(var(--glass-bg)/0.75)] hover:text-foreground"
              aria-label={t('nav.logout')}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/*
        Bottom navigation για κινητά. Ο αριθμός των στηλών ΠΡΕΠΕΙ να ταιριάζει
        με το πλήθος των links — αλλιώς σπάει σε δεύτερη σειρά.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
      <nav
        aria-label={t('nav.menu')}
        className="liquid-mobile-nav pointer-events-auto mx-auto max-w-md"
      >
        <ul className="grid grid-cols-5 gap-1 p-1.5">
          {links.map(({ href, label, Icon, match }) => (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={isActive(match) ? 'page' : undefined}
                data-active={isActive(match) ? 'true' : undefined}
                className={cn(
                  // min-h-[3.25rem]: άνετο σημείο αφής ακόμη κι όταν η ετικέτα
                  // είναι μονόλεκτη.
                  'liquid-nav-link flex min-h-[3.7rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold leading-none transition-[color,transform] duration-200',
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
