import { expect } from '@playwright/test';
import { Before } from './fixtures';

/**
 * Fixture reset — and the reason every line of it asserts.
 *
 * Reset is the most load-bearing part of a browser bank's isolation, and the natural way to
 * write it is a fire-and-forget POST. Here is what that cost on the first real adoption, in
 * full, because the shape matters more than the incident:
 *
 *   a new table with foreign keys was added to the schema; the reset's hard-coded delete list
 *   was not updated; the endpoint returned 500; the hook never read the response; and five
 *   scenarios passed against a half-deleted database. Nothing failed. It was found by a human
 *   reading the seed file.
 *
 * Three things follow, and this file is built out of them.
 *
 * **The failure mode is silent success, so anything that leaves the suite green is a non-fix.**
 * Every check below fails the run. None of them warns.
 *
 * **The diagnostic matters as much as the assertion.** "reset failed: 500" sends someone
 * hunting for an afternoon. Naming the delete list and the reset function turns the same 500
 * into a two-minute fix, so fill in RESET_IMPL and SCHEMA_SOURCE below — a placeholder left in
 * place is the difference between a message and an errand.
 *
 * **Two lists maintained by memory is the actual defect.** A delete list that every migration
 * must remember to update will eventually not be updated; that is what a list maintained by
 * memory does. So the endpoint is required to *enumerate* the schema rather than echo a
 * constant, and this hook checks that every table it found is one it cleared. That check runs
 * before every scenario, which means it runs on the pull request that adds the migration —
 * provided the bank is wired into CI, which is what
 * `node ${CLAUDE_PLUGIN_ROOT}/scripts/ci-wiring.mjs` is for.
 *
 * ## What your endpoint has to return
 *
 * ```json
 * {
 *   "reset":   ["users", "congresses", "bookings"],
 *   "tables":  ["users", "congresses", "bookings", "schema_migrations"],
 *   "ignored": ["schema_migrations"],
 *   "seeded":  true
 * }
 * ```
 *
 * `tables` must be read from the live schema — `information_schema.tables`, your ORM's model
 * registry, `sqlite_master`, whatever your stack offers. Not a constant. A constant is the
 * second list, and the second list is the bug.
 *
 * `ignored` is for tables that must survive a reset — migration bookkeeping, reference data.
 * Keeping them in a named list is fine, because forgetting to add one fails loudly here rather
 * than silently in production.
 *
 * ## Parallel runs
 *
 * A shared reset endpoint and `fullyParallel: true` are not compatible: worker A wipes the
 * database while worker B is three steps into a scenario, and the failure surfaces somewhere
 * else entirely. Pick one before you trust a run —
 *
 *   - run the bank with `workers: 1` (simplest, and fine for a bank of this size), or
 *   - give each worker its own database or schema and point this endpoint at the caller's, or
 *   - drop this hook and make every scenario create data under its own unique identifiers.
 *
 * ## If you have no reset endpoint
 *
 * Delete this file, and say in your PR how scenarios get clean state instead. What you must not
 * do is keep the file and weaken the assertion — that is the fire-and-forget hook again, with a
 * comment on top claiming otherwise.
 */

/** Where the reset lives. Override per project rather than editing this line in three places. */
const RESET_PATH = process.env.BANK_RESET_PATH ?? '/api/test/reset';

/**
 * The two places a failing reset is fixed, named in the failure message so nobody has to find
 * them at 2am. `/tddbanking:init` replaces these with this project's real paths. Leaving the
 * placeholders is not neutral — it downgrades every future diagnostic to a status code.
 */
const RESET_IMPL = process.env.BANK_RESET_IMPL ?? 'your reset handler (the code behind ' + RESET_PATH + ')';
const SCHEMA_SOURCE = process.env.BANK_RESET_SCHEMA ?? 'your seed/migration module';

/**
 * `complete` (the default) requires the endpoint to report which tables exist and to have
 * cleared all of them. `body` accepts a reset that says what it cleared without proving it was
 * everything. `status` accepts the status code alone, which is the fire-and-forget hook with
 * one extra line.
 *
 * Each step down re-opens part of the hole described above. The setting is an environment
 * variable rather than an edit to this file so that choosing it shows up in a diff someone
 * reviewed, and so that `grep BANK_RESET_EXPECT` finds every project that chose it.
 */
const EXPECT = process.env.BANK_RESET_EXPECT ?? 'complete';

const remedy = (extra: string) =>
  `${extra}\n\nIf a table was added recently it probably needs adding to the delete list in ` +
  `${SCHEMA_SOURCE} and to ${RESET_IMPL}.`;

Before(async ({ request, baseURL }) => {
  // This endpoint destroys data. A bank pointed at a preview deploy or staging through
  // BANK_BASE_URL would otherwise wipe it before every scenario, unattended, on a schedule.
  const host = new URL(baseURL ?? 'http://localhost').hostname;
  const disposable = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host);
  if (!disposable && process.env.BANK_RESET_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Refusing to POST ${RESET_PATH} at ${host}: it deletes data and this is not a local target. ` +
        'Point the bank at a disposable instance, or set BANK_RESET_ALLOW_REMOTE=1 if that host really is throwaway.',
    );
  }

  const response = await request.post(RESET_PATH, { failOnStatusCode: false });
  const status = response.status();
  const text = await response.text();

  if (status === 404) {
    throw new Error(
      `No fixture reset at ${RESET_PATH}. Implement it, point BANK_RESET_PATH at the real one, ` +
        'or delete steps/reset.ts and state how scenarios get clean state instead. Running the ' +
        'bank without a reset means every scenario inherits whatever the last one left behind, ' +
        'and the resulting failures depend on run order.',
    );
  }

  // Fail-closed, and fail with the fix. A half-reset database must never present as ready, so
  // this scenario stops here rather than running against whatever survived.
  expect(
    response.ok(),
    remedy(
      `Fixture reset ${RESET_PATH} returned ${status}. This scenario, and every scenario after ` +
        `it, would otherwise have run against whatever state the previous one left behind.\n` +
        `Response body: ${text}`,
    ),
  ).toBe(true);

  if (EXPECT === 'status') return;

  let body: { reset?: unknown; tables?: unknown; ignored?: unknown; seeded?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      remedy(
        `Fixture reset ${RESET_PATH} returned ${status} with a body that is not JSON, so there is ` +
          'no way to tell whether it reset anything. Return { "reset": [...], "tables": [...] }, ' +
          'or set BANK_RESET_EXPECT=status to accept the status code alone and own that risk.',
      ),
    );
  }

  const reset = Array.isArray(body.reset) ? (body.reset as string[]) : null;
  expect(
    reset !== null && reset.length > 0,
    remedy(
      `Fixture reset ${RESET_PATH} returned ${status} but reported nothing reset (${text}). A ` +
        'handler that skips a table silently still returns 200 — that is the case this assertion exists for.',
    ),
  ).toBe(true);

  if (body.seeded === false) {
    throw new Error(
      remedy(`Fixture reset ${RESET_PATH} cleared ${reset!.length} table(s) and reported seeded: false. ` +
        'The database is empty rather than seeded, which is a half-reset state: scenarios will fail ' +
        'on missing fixtures and the failures will look like application defects.'),
    );
  }

  if (EXPECT !== 'complete') return;

  const tables = Array.isArray(body.tables) ? (body.tables as string[]) : null;
  if (tables === null) {
    throw new Error(
      remedy(
        `Fixture reset ${RESET_PATH} does not report which tables exist, so nothing can check that ` +
          'it cleared all of them. Have it read the live schema (information_schema.tables, your ' +
          "ORM's model registry, sqlite_master) and return them as `tables`. A hard-coded list is " +
          'the second list that every migration has to remember, and that is the defect this hook ' +
          'is here to prevent. To proceed without the check, set BANK_RESET_EXPECT=body.',
      ),
    );
  }

  const ignored = new Set(Array.isArray(body.ignored) ? (body.ignored as string[]) : []);
  const uncleared = tables.filter((t) => !reset!.includes(t) && !ignored.has(t));
  expect(
    uncleared,
    remedy(
      `Fixture reset ${RESET_PATH} left ${uncleared.length} table(s) untouched: ${uncleared.join(', ')}. ` +
        'The schema has a table the reset does not know about, so every scenario after this one ' +
        'would have run against rows the previous scenario created. If a table is meant to survive ' +
        'a reset, name it in `ignored` rather than omitting it — an omission is indistinguishable ' +
        'from an oversight, which is how this got missed the first time.',
    ),
  ).toEqual([]);
});
