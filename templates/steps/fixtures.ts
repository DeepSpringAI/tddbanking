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
 *
 * The one hook that is not boring lives in `steps/reset.ts`: clearing state between scenarios,
 * and asserting that the clearing actually happened. It is imported from here only in the sense
 * that it uses this file's `Before` — it stays separate so that this file remains one nobody has
 * to touch.
 */
export const test = base;

export const { Given, When, Then, Before, After } = createBdd(test);
