import { test, expect } from '@playwright/test';
import { blockExternalRequests, collectPageErrors } from './helpers/console';

/**
 * Public smoke: every statically routed public page must return 200, carry a
 * non-empty <title> and raise no uncaught JS error. Covers both locale trees
 * (astro.config.mjs: locales ['id','en'], prefixDefaultLocale) plus the
 * standalone book landing page.
 */
const EN_PAGES = [
  '/en',
  '/en/about',
  '/en/blog',
  '/en/contact',
  '/en/get-a-quote',
  '/en/jobs',
  '/en/services',
  '/en/therapist',
  '/en/therapists',
];

const ID_PAGES = [
  '/id',
  '/id/about',
  '/id/blog',
  '/id/contact',
  '/id/get-a-quote',
  '/id/jobs',
  '/id/services',
];

/**
 * Routes that live outside the locale trees. `astro dev` answers these with a
 * 404 status while still rendering the right page (an i18n quirk of
 * prefixDefaultLocale) — the built site has dist/book/index.html etc. and
 * Firebase Hosting serves them 200 — so these assert content, not status.
 */
const UNPREFIXED_PAGES = ['/book'];

for (const path of ['/', ...EN_PAGES, ...ID_PAGES]) {
  test(`renders ${path}`, async ({ page }) => {
    await blockExternalRequests(page);
    const errors = collectPageErrors(page);

    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('body')).not.toBeEmpty();

    expect(errors, `uncaught page errors on ${path}`).toEqual([]);
  });
}

for (const path of UNPREFIXED_PAGES) {
  test(`renders ${path}`, async ({ page }) => {
    await blockExternalRequests(page);
    const errors = collectPageErrors(page);

    await page.goto(path, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('body')).not.toBeEmpty();

    expect(errors, `uncaught page errors on ${path}`).toEqual([]);
  });
}

test('locale chooser on / links to both locale trees', async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto('/');

  await expect(page).toHaveTitle('Spa Company Indonesia');
  await expect(page.locator('a[href="/en"]')).toBeVisible();
  await expect(page.locator('a[href="/id"]')).toBeVisible();

  await page.locator('a[href="/id"]').click();
  await expect(page).toHaveURL(/\/id\/?$/);
});

test('en and id home pages are genuinely different content', async ({ page }) => {
  await blockExternalRequests(page);

  await page.goto('/en');
  const enTitle = await page.title();

  await page.goto('/id');
  const idTitle = await page.title();

  expect(enTitle).not.toBe('');
  expect(idTitle).not.toBe('');
  expect(idTitle).not.toBe(enTitle);
});

test('unknown route serves the custom 404 page', async ({ page }) => {
  await blockExternalRequests(page);
  const response = await page.goto('/this-route-does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
});
