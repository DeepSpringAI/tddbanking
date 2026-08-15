import { test as base, createBdd } from 'playwright-bdd';

/**
 * Deliberately empty of page-object fixtures.
 *
 * Step definitions construct their own Page Objects from `page`:
 *
 *   When('I transfer {int} EUR to {string}', async ({ page }, amount, to) => {
 *     await new TransfersPage(page).transfer(amount, to);
 *   });
 *
 * A shared fixture registry is a single file every parallel implementer would have to edit,
 * which turns every merge into a conflict and serialises the one step that most needs to fan
 * out. Keep this file boring.
 */
export const test = base;

export const { Given, When, Then, Before, After } = createBdd(test);
