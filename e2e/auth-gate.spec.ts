import { test, expect } from '@playwright/test';
import { blockExternalRequests } from './helpers/console';

/**
 * Signed-out coverage for the two staff tools.
 *
 * Neither gate has a server session: /admin uses a client-side Firebase Auth
 * overlay (src/components/PasswordOverlay.astro) and /recruiter uses an email
 * login code verified by a Firebase callable function, with the resulting
 * session kept in localStorage (src/components/LoginGate.astro). There is no
 * cookie this suite can mint, so these specs assert the gate only.
 */

test.describe('/admin', () => {
  test('shows the staff sign-in overlay when signed out', async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto('/admin');

    const gate = page.locator('#auth-gate');
    await expect(gate).toBeVisible();
    await expect(gate.getByRole('heading', { name: 'Staff Access' })).toBeVisible();
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#auth-submit')).toBeVisible();
  });

  test('rejects a non-allowlisted email without any network call', async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto('/admin');

    await page.locator('#auth-email').fill('stranger@example.com');
    await page.locator('#auth-password').fill('whatever');
    await page.locator('#auth-submit').click();

    await expect(page.locator('#auth-error')).toHaveText(
      'This email is not authorized for admin access.',
    );
    await expect(page.locator('#auth-gate')).toBeVisible();
  });

  test('requires both email and password', async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto('/admin');

    await page.locator('#auth-submit').click();
    await expect(page.locator('#auth-error')).toHaveText('Please enter email and password.');
  });
});

test.describe('/recruiter', () => {
  test('shows the login-code gate and hides the panel when signed out', async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto('/recruiter');

    await expect(page.locator('#login-gate')).toBeVisible();
    await expect(page.locator('#step-email')).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#send-code-btn')).toBeVisible();

    // The protected panel markup exists but must not be shown.
    await expect(page.locator('#authenticated-content')).toBeHidden();
    await expect(page.locator('#recruiter-form')).toBeHidden();
  });

  test('refuses a non-company email domain before requesting a code', async ({ page }) => {
    await blockExternalRequests(page);
    await page.goto('/recruiter');

    await page.locator('#login-email').fill('someone@gmail.com');
    await page.locator('#send-code-btn').click();

    await expect(page.locator('#email-error')).toHaveText(
      'Please use a @spa-company.com email address.',
    );
    await expect(page.locator('#step-code')).toBeHidden();
    await expect(page.locator('#authenticated-content')).toBeHidden();
  });
});
