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
  // If steps/reset.ts is in use with a single shared database, this must be false (or set
  // workers: 1). A global reset and parallel workers are incompatible: one worker wipes the
  // database while another is mid-scenario, and the failure surfaces somewhere else entirely.
  // /tddbanking:init settles this at scaffold time; see the header of steps/reset.ts.
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
        // Playwright's own default here is `!process.env.CI`, and it is wrong for a bank.
        // It means: locally, if anything is already listening on this port, attach to it
        // silently instead of starting yours. The suite then reports on a build that is not
        // the one under test, and it reports it in green.
        //
        // Twice in one day on one machine: a first local smoke run came back 18/18 green for
        // a different worktree's build, caught only by someone noticing the port; and a second
        // session could not afterwards demonstrate that its local runs had not attached to a
        // foreign server, so numbers being treated as corroboration meant nothing.
        //
        // False makes a wrong answer an error: Playwright refuses to start on a taken port
        // and says so, instead of quietly succeeding against something else. Reuse is still
        // available, twice over -- BANK_REUSE_SERVER=1 to attach when present and start when
        // not, or BANK_BASE_URL to point the bank at an already-running app and skip webServer
        // entirely. Both are deliberate acts that show up in a shell history or a diff.
        //
        // Do not "fix" this back to the idiom. CI behaviour is identical either way; the only
        // thing the idiom changes is whether a local green can be trusted.
        reuseExistingServer: process.env.BANK_REUSE_SERVER === '1',
        timeout: 120_000,
      },
});
