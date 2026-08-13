import type { Page } from '@playwright/test';

/**
 * Every Page Object extends this. Locators live in Page Objects and nowhere else —
 * a locator in a step definition means the markup change that breaks it will break
 * many files instead of one.
 *
 * Prefer getByRole / getByLabel / getByText over CSS: they break when the user
 * experience breaks, which is the only time a browser test should break.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }
}
