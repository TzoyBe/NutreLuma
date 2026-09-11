import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileTabs } from '@/components/profile/profile-tabs';

describe('ProfileTabs', () => {
  it('shows the summary while keeping the editor behind a collapsed disclosure', () => {
    const html = renderToStaticMarkup(createElement(ProfileTabs, {
      profileSummary: createElement('p', null, 'Current weight: 64 kg'),
      profileEditor: createElement('input', { name: 'currentWeightKg', defaultValue: '64' }),
      coaching: createElement('p', null, 'Coaching settings'),
      plan: createElement('a', { href: '/billing' }, 'Manage subscription'),
      account: createElement('button', { type: 'button' }, 'Delete account'),
    }));

    expect(html).toContain('Current weight: 64 kg');
    expect(html).toContain('Edit profile');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="profile-editor"');
    expect(html).not.toContain('name="currentWeightKg"');
    expect(html).toContain('Coaching settings');
    expect(html).toContain('href="/billing"');
    expect(html).toContain('Delete account');
  });
});
