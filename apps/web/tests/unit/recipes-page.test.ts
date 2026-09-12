import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import RecipesPage from '@/app/(app)/recipes/page';
import { LocaleProvider } from '@/i18n/client';
import { ToastProvider } from '@/components/toast';

vi.mock('@/server/auth/guards', () => ({ requirePageUser: async () => ({ id: 'review-user' }) }));
vi.mock('@/server/services/profile', () => ({ getProfile: async () => ({ timezone: 'Europe/Athens' }) }));
vi.mock('@/server/services/recipe-plans', () => ({
  getCurrentRecipePlan: async () => ({
    remainingTarget: { calories: 812, proteinGrams: 55, carbohydrateGrams: 90, fatGrams: 23, fiberGrams: 10 },
    meals: [{}, {}, {}],
    estimatedDailyTotal: { calories: 0, proteinGrams: 0, carbohydrateGrams: 0, fatGrams: 0, fiberGrams: 0 },
  }),
}));
vi.mock('@/server/services/saved-recipes', () => ({ listSavedRecipes: async () => [{}, {}] }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'en' }) }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), redirect: vi.fn() }));

it('leads with the recipes hero and journey strip, then the plan and saved panels', async () => {
  const html = renderToStaticMarkup(createElement(LocaleProvider, {
    locale: 'en', children: createElement(ToastProvider, { children: await RecipesPage() }),
  }));
  const hero = html.indexOf('recipes-universe-card');
  const journey = html.indexOf('Meals planned today');
  const plan = html.indexOf('AI meal plan');
  const savedHeading = html.lastIndexOf('Saved recipes');
  for (const position of [hero, journey, plan, savedHeading]) expect(position).toBeGreaterThan(-1);
  expect(hero).toBeLessThan(journey);
  expect(journey).toBeLessThan(plan);
  expect(plan).toBeLessThan(savedHeading);
  expect(html).toContain('>812<');
  expect(html).toContain('>3<');
  expect(html).toContain('>2<');
});
