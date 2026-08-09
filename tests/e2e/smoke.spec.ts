import { expect, test } from '@playwright/test';

/**
 * End-to-end smoke tests.
 * Απαιτούν να τρέχει η εφαρμογή (π.χ. `docker compose up`) στο E2E_BASE_URL.
 */

const unique = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
const PASSWORD = 'E2ePassw0rdTest';

test.describe('δημόσιες σελίδες', () => {
  test('η landing page φορτώνει και οδηγεί στην εγγραφή', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('link', { name: /Ξεκίνα δωρεάν/ }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('η σελίδα απορρήτου περιέχει το disclaimer', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText(/δεν παρέχει ιατρική/)).toBeVisible();
  });
});

test.describe('προστασία σελίδων', () => {
  test('ανώνυμος χρήστης ανακατευθύνεται στο login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('τα προστατευμένα API επιστρέφουν 401 χωρίς session', async ({ request }) => {
    const response = await request.get('/api/dashboard');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  test('το health endpoint είναι δημόσιο', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('πλήρης ροή χρήστη', () => {
  test('εγγραφή, προφίλ και dashboard', async ({ page }) => {
    const email = `${unique()}@example.com`;

    await page.goto('/register');
    await page.getByLabel('Όνομα εμφάνισης').fill('E2E Χρήστης');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Κωδικός', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Επιβεβαίωση κωδικού').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Εγγραφή' }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

    await page.getByLabel('Όνομα', { exact: true }).fill('E2E');
    await page.getByLabel('Ημερομηνία γέννησης').fill('1990-05-14');
    await page.getByLabel('Ύψος (cm)').fill('178');
    await page.getByLabel('Τρέχον βάρος (kg)').fill('82');
    await page.getByRole('button', { name: /Αποθήκευση προφίλ/ }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/Θερμίδες σήμερα/)).toBeVisible();

    // Αποσύνδεση
    await page.getByRole('button', { name: 'Αποσύνδεση' }).click();
    await page.getByRole('button', { name: 'Αποσύνδεση' }).last().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('απορρίπτεται εγγραφή με μη ταιριαστούς κωδικούς', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Όνομα εμφάνισης').fill('E2E');
    await page.getByLabel('Email').fill(`${unique()}@example.com`);
    await page.getByLabel('Κωδικός', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Επιβεβαίωση κωδικού').fill('DifferentPass1');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Εγγραφή' }).click();

    await expect(page.getByText('Οι κωδικοί δεν ταιριάζουν.')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });
});
