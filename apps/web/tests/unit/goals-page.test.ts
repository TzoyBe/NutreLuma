import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import GoalsPage from '@/app/(app)/goals/page';
import { LocaleProvider } from '@/i18n/client';
import { ToastProvider } from '@/components/toast';

vi.mock('@/server/auth/guards', () => ({ requirePageUser: async () => ({ id: 'review-user' }) }));
vi.mock('@/server/services/profile', () => ({ getProfile: async () => ({ timezone: 'Europe/Athens' }) }));
vi.mock('@/server/services/goals', () => ({
  getGoalForDay: async () => ({ calorieTarget: 2100, proteinGrams: 132, carbohydrateGrams: 240,
    fatGrams: 70, fiberGrams: 30, waterMl: 2500, stepsTarget: 8000 }),
  suggestGoals: async () => ({ calorieTarget: 2200, proteinGrams: 140, carbohydrateGrams: 260,
    fatGrams: 70, fiberGrams: 30, waterMl: 2600 }),
  listGoalHistory: async () => [],
  countGoalHistory: async () => 0,
}));
vi.mock('@/server/services/achievements', () => ({ listAchievements: async () => [] }));
vi.mock('@/server/services/badges', () => ({ listBadges: async () => [] }));
vi.mock('@/server/services/milestones', () => ({ countActiveMilestones: async () => 0 }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'en' }) }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), redirect: vi.fn() }));

it('places primary editing actions after the hero and before journey destinations and history', async () => {
  const html = renderToStaticMarkup(createElement(LocaleProvider, {
    locale: 'en', children: createElement(ToastProvider, { children: await GoalsPage() }),
  }));
  const hero = html.indexOf('goals-universe-card');
  const edit = html.indexOf('Edit goals');
  const suggestion = html.indexOf('Use suggested values');
  const journey = html.indexOf('href="/goals/achievements"');
  const history = html.lastIndexOf('Goal history</');
  for (const position of [hero, edit, suggestion, journey, history]) expect(position).toBeGreaterThan(-1);
  expect(hero).toBeLessThan(edit);
  expect(edit).toBeLessThan(journey);
  expect(suggestion).toBeLessThan(journey);
  expect(journey).toBeLessThan(history);
});
