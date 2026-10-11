import { test, expect } from '@playwright/test';
import { blockExternalRequests, collectPageErrors } from './helpers/console';

/**
 * Book + checkout coverage.
 *
 * These specs never complete a purchase: all third-party traffic (PayPal SDK,
 * Firestore, the FormSubmit relay) is blocked, and the only button exercised is
 * the bank-transfer one with an empty form, which bails out at the client-side
 * validation guard before any `addDoc` call. No order is ever created.
 */

test('book page lists the three purchase formats', async ({ page }) => {
  await blockExternalRequests(page);
  const errors = collectPageErrors(page);

  await page.goto('/book');

  await expect(page.getByRole('heading', { name: 'How to Run a Spa' })).toBeVisible();
  await expect(page.getByText('$19.99')).toBeVisible();
  await expect(page.getByText('$14.99')).toBeVisible();
  await expect(page.getByText('$27.99')).toBeVisible();

  for (const key of ['print', 'digital', 'bundle']) {
    await expect(page.locator(`a[href="/checkout?format=${key}"]`)).toHaveCount(1);
  }

  expect(errors).toEqual([]);
});

test('book page purchase link carries the format into checkout', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/book');

  await page.locator('a[href="/checkout?format=bundle"]').click();

  await page.waitForURL(/\/checkout\?format=bundle$/, { timeout: 30_000 });
  await expect(page.locator('#format-label')).toHaveText('Bundle (Print + Digital)');
  await expect(page.locator('#format-price')).toHaveText('$27.99');
});

test('checkout prices the digital format and hides shipping fields', async ({ page }) => {
  await blockExternalRequests(page);
  const errors = collectPageErrors(page);

  await page.goto('/checkout?format=digital');

  await expect(page.locator('#format-label')).toHaveText('Digital (PDF)');
  await expect(page.locator('#format-price')).toHaveText('$14.99');
  await expect(page.locator('#shipping-fields')).toBeHidden();

  expect(errors).toEqual([]);
});

test('checkout reveals shipping fields for a physical format', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/checkout?format=print');

  await expect(page.locator('#format-label')).toHaveText('Print Book');
  await expect(page.locator('#format-price')).toHaveText('$19.99');
  await expect(page.locator('#shipping-fields')).toBeVisible();
  await expect(page.locator('#customer-address')).toBeVisible();
});

test('checkout falls back to the digital format for an unknown format key', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/checkout?format=not-a-real-format');

  await expect(page.locator('#format-label')).toHaveText('Digital (PDF)');
  await expect(page.locator('#format-price')).toHaveText('$14.99');
});

test('checkout payment-method tabs switch panels', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/checkout?format=digital');

  const paypalPanel = page.locator('#panel-paypal');
  const transferPanel = page.locator('#panel-transfer');

  // The PayPal panel is only ever filled by the blocked third-party SDK, so it
  // has no box of its own — assert the `hidden` class the page actually toggles
  // rather than CSS visibility.
  await expect(paypalPanel).not.toHaveClass(/\bhidden\b/);
  await expect(transferPanel).toHaveClass(/\bhidden\b/);

  await page.locator('#tab-transfer').click();
  await expect(transferPanel).not.toHaveClass(/\bhidden\b/);
  await expect(transferPanel).toBeVisible();
  await expect(paypalPanel).toHaveClass(/\bhidden\b/);

  await page.locator('#tab-paypal').click();
  await expect(paypalPanel).not.toHaveClass(/\bhidden\b/);
  await expect(transferPanel).toHaveClass(/\bhidden\b/);
});

test('bank transfer refuses an empty customer form (no order is created)', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/checkout?format=digital');

  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.locator('#tab-transfer').click();
  await page.locator('#transfer-confirm-btn').click();

  await expect.poll(() => dialogs).toEqual(['Please fill in your email and name above.']);

  // Validation bailed out before saveOrder(), so the pending state never shows.
  await expect(page.locator('#transfer-pending')).toBeHidden();
  await expect(page.locator('#transfer-confirm-btn')).toBeEnabled();
});

test('bank transfer refuses a malformed email (no order is created)', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/checkout?format=digital');

  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.locator('#customer-email').fill('not-an-email');
  await page.locator('#customer-name').fill('E2E Test');
  await page.locator('#tab-transfer').click();
  await page.locator('#transfer-confirm-btn').click();

  await expect.poll(() => dialogs).toEqual(['Please fill in your email and name above.']);
  await expect(page.locator('#transfer-pending')).toBeHidden();
});

test('bank transfer details are shown for both bank accounts', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/checkout?format=digital');

  await page.locator('#tab-transfer').click();
  await expect(page.getByText('SK87 0200 0000 0049 3335 1257')).toBeVisible();
  await expect(page.getByText('022-3-87408-8')).toBeVisible();
});
