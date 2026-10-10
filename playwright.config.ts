import { defineConfig, devices } from '@playwright/test';

// Dedicated e2e port so the suite never attaches to a developer's own
// `npm run dev` on Astro's default 4321.
const PORT = 4357;

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 1,
  reporter: 'list',
  // The dev server compiles routes on demand, so first-hit navigations can be
  // slow; give assertions more room than the 5s default.
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Deterministic, non-secret placeholders. Vite gives real process env vars
    // precedence over .env, so e2e never talks to the live Firebase project —
    // and CI needs no secrets at all.
    env: {
      PUBLIC_FIREBASE_API_KEY: 'e2e-placeholder',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'e2e-placeholder.firebaseapp.com',
      PUBLIC_FIREBASE_PROJECT_ID: 'e2e-placeholder',
      PUBLIC_FIREBASE_STORAGE_BUCKET: 'e2e-placeholder.appspot.com',
      PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
      PUBLIC_PAYPAL_CLIENT_ID: 'e2e-placeholder',
    },
  },
});
