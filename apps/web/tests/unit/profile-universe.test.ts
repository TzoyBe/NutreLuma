import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileUniverse } from '@/components/profile/profile-universe';
import { buildProfileUniverseModel } from '@/components/profile/profile-universe-model';

describe('ProfileUniverse', () => {
  it('presents identity and measured values with supplied locale labels', () => {
    const html = renderToStaticMarkup(createElement(ProfileUniverse, {
      model: buildProfileUniverseModel({
        displayName: 'Ada Lovelace', email: 'ada@example.com', dailyTarget: 1900,
        age: 31, bmi: { value: 22.4, label: 'Healthy' }, planStatus: 'Trial',
      }),
      labels: { title: 'Το προφίλ σου', dailyTarget: 'Ημερήσιος στόχος', planStatus: 'Πλάνο', age: 'Ηλικία', bmi: 'BMI' },
    }));

    expect(html).toContain('aria-labelledby="profile-universe-title"');
    for (const text of ['Το προφίλ σου', 'Ημερήσιος στόχος', 'Πλάνο', 'Ηλικία', 'Ada Lovelace', 'ada@example.com', '1900', '31', '22.4', 'Healthy', 'Trial']) {
      expect(html).toContain(text);
    }
  });
});
