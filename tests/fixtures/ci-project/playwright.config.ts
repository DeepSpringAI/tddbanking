import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'bank', testDir: './.features-gen', use: { ...devices['Desktop Chrome'] } },
    { name: 'legacy', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
    { name: 'visual', testDir: './tests/visual', use: { ...devices['Desktop Chrome'] } },
  ],
});
