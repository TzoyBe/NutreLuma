import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { LocaleProvider } from '@/i18n/client';

const tabKeys = ['profile', 'coaching', 'plan', 'account'] as const;

function renderTabs(locale: 'en' | 'el' = 'en') {
  return renderToStaticMarkup(createElement(LocaleProvider, {
    locale,
    children: createElement(ProfileTabs, {
      profileSummary: createElement('p', null, 'Current weight: 64 kg'),
      profileEditor: createElement('input', { name: 'currentWeightKg', defaultValue: '64' }),
      coaching: createElement('p', null, 'Coaching settings'),
      plan: createElement('a', { href: '/billing' }, 'Manage subscription'),
      account: createElement('button', { type: 'button' }, 'Delete account'),
    }),
  }));
}

describe('ProfileTabs', () => {
  it('shows the summary while keeping the editor behind a collapsed disclosure', () => {
    const html = renderTabs();

    expect(html).toContain('Current weight: 64 kg');
    expect(html).toContain('Edit profile');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="profile-editor"');
    expect(html).not.toContain('name="currentWeightKg"');
    expect(html).toContain('Coaching settings');
    expect(html).toContain('href="/billing"');
    expect(html).toContain('Delete account');
  });

  it('connects four 44px tab targets to their labelled panels', () => {
    const html = renderTabs();
    const tabButtons = html.match(/<button(?=[^>]*role="tab")[^>]*>/g) ?? [];

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Profile"');
    expect(tabButtons).toHaveLength(4);
    expect(tabButtons.filter((button) => button.includes('aria-selected="true"'))).toHaveLength(1);
    expect(tabButtons.every((button) => button.includes('min-h-11'))).toBe(true);

    for (const key of tabKeys) {
      expect(html).toContain(`id="profile-tab-${key}"`);
      expect(html).toContain(`aria-controls="profile-panel-${key}"`);
      expect(html).toContain(`id="profile-panel-${key}"`);
      expect(html).toContain(`aria-labelledby="profile-tab-${key}"`);
    }
    expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
  });

  it('localizes the profile edit action', () => {
    expect(renderTabs('el')).toContain('Επεξεργασία προφίλ');
  });
});
