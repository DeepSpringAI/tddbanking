import { expect } from '@playwright/test';
import { When, Then } from './fixtures';

// Steps for features/example.feature. Delete both once you have real scenarios.
When('I open the home page', async ({ page }) => {
  await page.goto('/');
});

Then('the page has loaded', async ({ page }) => {
  await expect(page).toHaveTitle(/.+/);
});
