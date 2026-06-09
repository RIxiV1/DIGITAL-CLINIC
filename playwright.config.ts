import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config — real-browser tests for the things jsdom can't see:
 * page-transition DOM leaks, scroll-lock leaks, and layout/scroll
 * behavior. Unit tests (vitest, jsdom) stay separate; run these with
 * `npm run test:e2e`.
 *
 * We drive the Vite dev server (fast to boot, and the bugs these tests
 * guard reproduce on client-side navigation regardless of dev/prod).
 * Playwright boots it for us and tears it down after.
 *
 * Mobile profile: the regressions here are mobile-first (the ghost-page
 * overlay broke scroll on the phone PWA), so the default project emulates
 * a phone.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
