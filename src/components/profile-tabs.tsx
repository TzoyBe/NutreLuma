'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, Scale, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';

const TABS = [
  { href: '/profile', labelKey: 'profile.tabAccount', Icon: UserCog },
  { href: '/profile/weight', labelKey: 'profile.tabWeight', Icon: Scale },
  { href: '/profile/billing', labelKey: 'profile.tabBilling', Icon: CreditCard },
] as const;

/**
 * Υπο-μενού του προφίλ. Οριζόντια κύλιση σε στενές οθόνες αντί για αναδίπλωση,
 * ώστε το ύψος του header να μένει σταθερό.
 */
export function ProfileTabs() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label={t('profile.title')}
      className="glass -mx-1 flex gap-1 overflow-x-auto rounded-full p-1"
    >
      {TABS.map(({ href, labelKey, Icon }) => {
        // Το /profile είναι ενεργό μόνο ακριβώς — αλλιώς θα ήταν πάντα ενεργό.
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
