import { readFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { chromium, type Browser, type Page } from '@playwright/test';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import config from '../../tailwind.config';
import { GoalsUniverse } from '../../src/components/goals/goals-universe';
import { buildGoalUniverseModel } from '../../src/components/goals/goals-universe-model';
import { ProfileUniverse } from '../../src/components/profile/profile-universe';
import { buildProfileUniverseModel } from '../../src/components/profile/profile-universe-model';
import { ProfileTabs } from '../../src/components/profile/profile-tabs';
import { LocaleProvider } from '../../src/i18n/client';
import { t, type Locale } from '../../src/i18n';

let css: string;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  css = (await postcss([tailwindcss(config)]).process(
    readFileSync('src/app/globals.css', 'utf8'), { from: 'src/app/globals.css' },
  )).css + ':root { --font-inter: Arial; --font-sora: Arial; }';
});
beforeEach(async () => { page = await browser.newPage(); });
afterEach(async () => { await page?.close(); });
afterAll(async () => { await browser?.close(); });

function surfaces(locale: Locale) {
  return renderToStaticMarkup(createElement(LocaleProvider, {
    locale,
    children: createElement('main', { className: 'space-y-5', style: { padding: 16, maxWidth: 960, margin: 'auto' } },
      createElement(GoalsUniverse, {
        model: buildGoalUniverseModel({ calorieTarget: 2100, proteinGrams: 132, carbohydrateGrams: 240,
          fatGrams: 70, achievementsUnlocked: 4, achievementsTotal: 12, badgesUnlocked: 3,
          activeMilestones: 2, historyCount: 6 }),
        labels: { title: t('goals.title', locale), protein: t('goals.protein', locale),
          carbohydrate: t('goals.carbohydrate', locale), fat: t('goals.fat', locale) },
      }),
      createElement(ProfileUniverse, {
        model: buildProfileUniverseModel({ displayName: 'Alexandra Παπαδοπούλου',
          email: 'alexandra.papadopoulou@example.com', dailyTarget: 2100, age: 34,
          bmi: { value: 23.1, label: t('profile.bmiHealthy', locale) }, currentWeightKg: 64,
          targetWeightKg: 62, activityLevel: 'MODERATE', goal: 'MAINTAIN', planStatus: 'Active' }),
        labels: { title: t('profile.title', locale), dailyTarget: t('onboarding.dailyCalorieTarget', locale),
          planStatus: t('profile.tabPlan', locale), age: t('profile.age', locale), bmi: t('profile.bmi', locale) },
      }),
      createElement(ProfileTabs, { profileSummary: null, profileEditor: null, coaching: null,
        plan: null, account: null }),
    ),
  }));
}

for (const locale of ['en', 'el'] as const) {
  for (const width of [320, 390, 1280]) {
    test(`${locale} surfaces fit at ${width}px with readable goals and reachable tabs`, async () => {
      await page.setViewportSize({ width, height: 1100 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setContent(`<style>${css}</style>${surfaces(locale)}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const center = await page.locator('.goals-universe-center').boundingBox();
      expect(center!.height).toBeGreaterThanOrEqual(128);
      const macros = await page.locator('.goals-universe-macro').all();
      for (const macro of macros) {
        const box = (await macro.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(center!.y + center!.height);
        expect(await macro.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      }
      for (const tab of await page.getByRole('tab').all()) {
        await tab.scrollIntoViewIfNeeded();
        await tab.focus();
        await expect.poll(async () => {
          const box = (await tab.boundingBox())!;
          return box.x >= 0 && box.x + box.width <= width;
        }).toBe(true);
        expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await tab.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');
      }
      if (process.env.UNIVERSE_SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.UNIVERSE_SCREENSHOT_DIR}/${locale}-${width}.png`, fullPage: true });
      }
    });
  }
}

test('ambient decoration ignores pointer input and reduced motion leaves all content visible', async () => {
  await page.setContent(`<style>${css}</style>${surfaces('en')}`);
  const orbit = page.locator('.universe-app-orbit');
  expect(await orbit.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe('none');
  expect(await orbit.evaluate((node) => getComputedStyle(node).animationName)).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await orbit.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  expect(await orbit.evaluate((node) => getComputedStyle(node).transform)).toBe('none');
  for (const hero of await page.locator('.goals-universe-card, .profile-universe-card').all()) {
    expect(await hero.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  }
});

test('the no-backdrop-filter fallback paints opaque readable hero surfaces', async () => {
  // Execute the fallback branch in Chromium, whose native backdrop-filter support is always on.
  const fallback = postcss.parse(css);
  fallback.walkAtRules('supports', (rule) => {
    if (rule.params.startsWith('not ((backdrop-filter:')) { rule.name = 'media'; rule.params = 'all'; }
  });
  await page.setContent(`<style>${fallback.toString()}</style>${surfaces('en')}`);
  for (const hero of await page.locator('.goals-universe-card, .profile-universe-card').all()) {
    const alpha = await hero.evaluate((node) => {
      const color = getComputedStyle(node).backgroundColor;
      return color.startsWith('rgba') ? Number(color.split(',')[3].replace(')', '')) : 1;
    });
    expect(alpha).toBeGreaterThanOrEqual(0.98);
    expect(await hero.evaluate((node) => getComputedStyle(node).backgroundImage)).toBe('none');
  }
});

test('keyboard focus reveals the complete Greek Account tab without changing selection', async () => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { ProfileTabs } from './src/components/profile/profile-tabs';
        import { LocaleProvider } from './src/i18n/client';
        createRoot(document.getElementById('root')).render(
          React.createElement(LocaleProvider, { locale: 'el' },
            React.createElement(ProfileTabs, { profileSummary: null, profileEditor: null,
              coaching: null, plan: null, account: null })));`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    alias: { '@': path.resolve('src') },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent(`<style>${css}</style><main style="padding:16px"><div id="root"></div></main>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole('tab').first().waitFor();
  for (let index = 0; index < 4; index++) await page.keyboard.press('Tab');
  const account = page.getByRole('tab').last();
  expect(await account.evaluate((node) => document.activeElement === node)).toBe(true);
  const tab = (await account.boundingBox())!;
  const strip = (await page.getByRole('tablist').boundingBox())!;
  expect(tab.x).toBeGreaterThanOrEqual(strip.x);
  expect(tab.x + tab.width).toBeLessThanOrEqual(strip.x + strip.width);
  expect(await page.getByRole('tab').first().getAttribute('aria-selected')).toBe('true');
  await page.keyboard.press('Enter');
  await expect.poll(() => account.getAttribute('aria-selected')).toBe('true');
});
