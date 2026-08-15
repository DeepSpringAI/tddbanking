import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Drafts are excluded at generation time by the --tags flag in package.json scripts,
// never here. Run `npm run test:bank`, not `bddgen` directly.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.ts', 'pages/**/*.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BANK_BASE_URL ?? 'http://localhost:3000',
    // Triage depends on these. Do not turn them off to save CI storage.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // /tddbanking:init replaces `command` and `url` with this repo's real dev
  // server. Without this, CI has nothing to test against. Set BANK_BASE_URL to
  // point the bank at an already-running app (staging, a preview deploy) and
  // skip starting one locally.
  webServer: process.env.BANK_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
