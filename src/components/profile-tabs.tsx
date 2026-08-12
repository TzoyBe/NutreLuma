'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, Database, UserCog, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';

const TABS = [
  { href: '/profile', labelKey: 'profile.tabAccount', Icon: UserCog },
  { href: '/profile/billing', labelKey: 'profile.tabBilling', Icon: CreditCard },
] as const;

const ADMIN_TABS = [
  { href: '/admin/users', labelKey: 'admin.usersTitle', Icon: Users },
  { href: '/admin/db', labelKey: 'admin.dbTitle', Icon: Database },
] as const;

export function ProfileTabs({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const tabs = isAdmin ? [...TABS, ...ADMIN_TABS] : TABS;

  return (
    <nav
      aria-label={t('profile.title')}
      className="glass -mx-1 flex gap-1 overflow-x-auto rounded-full p-1"
    >
      {tabs.map(({ href, labelKey, Icon }) => {
        const active = href === '/profile' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.9)]'
                : 'text-muted-foreground hover:bg-[hsl(var(--glass-bg)/0.7)] hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
