import { test as base, createBdd } from 'playwright-bdd';

/**
 * One fixture per Page Object. Step definitions receive them by name, which is what
 * keeps steps thin:
 *
 *   When('I transfer {int} EUR to {string}', async ({ transfersPage }, amount, to) => {
 *     await transfersPage.transfer(amount, to);
 *   });
 */
type BankFixtures = {
  // transfersPage: TransfersPage;
};

export const test = base.extend<BankFixtures>({
  // transfersPage: async ({ page }, use) => { await use(new TransfersPage(page)); },
});

export const { Given, When, Then, Before, After } = createBdd(test);
