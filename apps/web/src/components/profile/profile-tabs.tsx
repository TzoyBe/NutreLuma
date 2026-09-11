'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';

/**
 * Tabbed Profile για το web — parity με το mobile (Profile / Coaching / Plan /
 * Account). Τα panels έρχονται server-rendered ως children· ο client wrapper
 * απλώς εναλλάσσει ποιο είναι ορατό.
 */

type TabKey = 'profile' | 'coaching' | 'plan' | 'account';

const TABS: ReadonlyArray<readonly [TabKey, string]> = [
  ['profile', 'profile.tabProfile'],
  ['coaching', 'profile.tabCoaching'],
  ['plan', 'profile.tabPlan'],
  ['account', 'profile.tabAccount'],
];

export function ProfileTabs({
  profileSummary,
  profileEditor,
  coaching,
  plan,
  account,
}: {
  profileSummary: React.ReactNode;
  profileEditor: React.ReactNode;
  coaching: React.ReactNode;
  plan: React.ReactNode;
  account: React.ReactNode;
}) {
  const t = useT();
  const [active, setActive] = React.useState<TabKey>('profile');
  const [editing, setEditing] = React.useState(false);
  const profile = (
    <>
      {profileSummary}
      <Button
        type="button"
        variant="secondary"
        aria-expanded={editing}
        aria-controls="profile-editor"
        onClick={() => setEditing((current) => !current)}
      >
        Edit profile
      </Button>
      <div id="profile-editor" hidden={!editing}>
        {editing ? profileEditor : null}
      </div>
    </>
  );
  const slots: Record<TabKey, React.ReactNode> = { profile, coaching, plan, account };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl border border-border bg-secondary/40 p-1">
        {TABS.map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={cn(
              'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
              active === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(labelKey as never)}
          </button>
        ))}
      </div>

      {(Object.keys(slots) as TabKey[]).map((key) => (
        <div key={key} className={cn('space-y-4', active === key ? '' : 'hidden')}>
          {slots[key]}
        </div>
      ))}
    </div>
  );
}
