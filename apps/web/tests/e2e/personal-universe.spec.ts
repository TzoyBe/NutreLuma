import { expect, test } from '@playwright/test';

test.describe('Personal Universe public experience', () => {
  test('the landing hero introduces the personalized constellation and links to registration', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Built around your patterns.' }),
    ).toBeVisible();
    await expect(page.getByTestId('personal-universe-constellation')).toBeVisible();

    await page.getByRole('link', { name: /build my plan/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('login and registration share the Personal Universe visual shell', async ({ page }) => {
    for (const route of ['/login', '/register']) {
      await page.goto(route);
      await expect(page.getByTestId('personal-universe-auth-shell')).toBeVisible();
      await expect(page.getByTestId('personal-universe-auth-orbit')).toBeVisible();
    }
  });
});
