'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { ProfileSaveSuccessContext } from './profile-save-success-context';

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
  const handleProfileSaveSuccess = React.useCallback(() => setEditing(false), []);
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
        {t('profile.editProfile')}
      </Button>
      <div id="profile-editor" hidden={!editing}>
        <ProfileSaveSuccessContext.Provider value={handleProfileSaveSuccess}>
          {editing ? profileEditor : null}
        </ProfileSaveSuccessContext.Provider>
      </div>
    </>
  );
  const slots: Record<TabKey, React.ReactNode> = { profile, coaching, plan, account };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={t('profile.title')}
        className="universe-app-tabs flex gap-1 rounded-2xl border border-border bg-secondary/40 p-1"
      >
        {TABS.map(([key, labelKey]) => (
          <button
            key={key}
            id={`profile-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={active === key}
            aria-controls={`profile-panel-${key}`}
            onFocus={(event) =>
              event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            }
            onClick={() => setActive(key)}
            className={cn(
              'min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
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
        <div
          key={key}
          id={`profile-panel-${key}`}
          role="tabpanel"
          aria-labelledby={`profile-tab-${key}`}
          hidden={active !== key}
          className="space-y-4"
        >
          {slots[key]}
        </div>
      ))}
    </div>
  );
}
