import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import AddMealPage from '@/app/(app)/meals/add/page';
import { LocaleProvider } from '@/i18n/client';
import { ToastProvider } from '@/components/toast';

vi.mock('@/server/auth/guards', () => ({ requirePageUser: async () => ({ id: 'review-user' }) }));
vi.mock('@/server/services/profile', () => ({
  getProfile: async () => ({ timezone: 'Europe/Athens' }),
  getUserTimezone: async () => 'Europe/Athens',
}));
vi.mock('@/server/services/meal-history', () => ({
  getFavorites: async () => [],
  getFrequentMeals: async () => [],
  getRecentMeals: async () => [],
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'en' }) }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), redirect: vi.fn() }));

it('leads with a single camera hero and one manual-entry link, not a two-button grid', async () => {
  const html = renderToStaticMarkup(createElement(LocaleProvider, {
    locale: 'en', children: createElement(ToastProvider, { children: await AddMealPage() }),
  }));
  expect(html).toContain('Point, shoot, done.');
  expect(html).toContain('href="/meals/new"');
  expect(html.match(/Manual Entry/g)?.length).toBe(1);
  expect(html).toContain('href="/meals/manual"');
  expect(html).not.toContain('Type it in');
  expect(html).not.toContain('Speak it');

  const hero = html.indexOf('add-meal-hero');
  const shutter = html.indexOf('href="/meals/new"');
  const manual = html.indexOf('href="/meals/manual"');
  const favorites = html.indexOf('>Favorites<');
  expect(hero).toBeGreaterThan(-1);
  expect(hero).toBeLessThan(shutter);
  expect(shutter).toBeLessThan(manual);
  expect(manual).toBeLessThan(favorites);
});

it('marks the decorative orbit as hidden from assistive tech', async () => {
  const html = renderToStaticMarkup(createElement(LocaleProvider, {
    locale: 'en', children: createElement(ToastProvider, { children: await AddMealPage() }),
  }));
  expect(html).toMatch(/class="universe-app-orbit" aria-hidden="true"/);
});
