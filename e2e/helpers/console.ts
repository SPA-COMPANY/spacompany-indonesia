import type { Page } from '@playwright/test';

/**
 * Vite's dependency optimizer re-bundles on first request and makes already
 * in-flight dynamic imports 404 for a moment. That is a dev-server artifact,
 * not a site bug, and it cannot happen in the built site — so it is the one
 * class of page error the smoke tests tolerate.
 */
const DEV_SERVER_NOISE = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /dynamically imported module/i,
];

export function isDevServerNoise(message: string): boolean {
  return DEV_SERVER_NOISE.some((re) => re.test(message));
}

/** Collect real (non dev-server-noise) uncaught page errors. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    if (!isDevServerNoise(err.message)) errors.push(err.message);
  });
  return errors;
}

/**
 * Block third-party endpoints so a test run can never touch PayPal, Firebase,
 * Google Fonts or the FormSubmit relay. Keeps the suite hermetic and makes it
 * impossible for a spec to create real data.
 */
export async function blockExternalRequests(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost') || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });
}
