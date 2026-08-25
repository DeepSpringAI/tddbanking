---
description: Scaffold a Playwright BDD test bank in this repo (one-time setup)
argument-hint: optional base URL of the running app
---

Set up a test bank in this repository. Read the `tddbanking` skill first for the tag
vocabulary you are about to bake into the config.

Base URL: $ARGUMENTS — if empty, detect the dev server command and port from `package.json`,
and ask rather than guessing a port.

1. **Check for an existing bank.** If `features/` with `.feature` files already exists, do
   not overwrite anything. Report what is there and stop.
2. **Detect the package manager** from the lockfile (`pnpm-lock.yaml`, `yarn.lock`,
   `package-lock.json`, `bun.lockb`). Use it consistently; do not introduce a second one.
3. **Install** `playwright-bdd` and `@playwright/test` as dev dependencies, then
   `npx playwright install chromium`.
4. **Write the scaffold** from `${CLAUDE_PLUGIN_ROOT}/templates/`:
   - `playwright.config.ts` — **skip if one exists**, and merge instead. A repo that already
     uses Playwright has a config worth keeping, and its existing specs must keep running.
     Playwright has a single top-level `testDir`, so the bank cannot claim it. Give the bank
     its **own project** with its own `testDir`, leaving the top-level one to the existing
     suite:

     ```ts
     import { defineBddConfig } from 'playwright-bdd';

     const bankTestDir = defineBddConfig({
       features: 'features/**/*.feature',
       steps: ['steps/**/*.ts', 'pages/**/*.ts'],
       outputDir: '.features-gen',
     });

     export default defineConfig({
       testDir: './tests/e2e',          // untouched, the existing suite
       projects: [
         { name: 'bank', testDir: bankTestDir, use: { ...devices['Desktop Chrome'] } },
         // ...existing projects, unchanged
       ],
     });
     ```

     Top-level `use` and `webServer` are inherited by the bank project, so an existing server
     setup is reused rather than duplicated. Say exactly what you changed, then confirm the
     existing suite still resolves: `npx playwright test --list` should report the same file
     count as before, plus the bank.
   - `pages/BasePage.ts`, `steps/fixtures.ts`, `steps/example.ts`,
     `features/example.feature`, `decisions.md`
   - `steps/fixtures.ts` intentionally registers no page-object fixtures. Steps construct
     their own Page Objects from `page`, so that turn 2 can implement many capabilities in
     parallel without every worker editing one shared file.
   - `decisions.md` at the repo root is the loop's escalation channel — the one place every
     turn writes product questions and the one place every turn reads before asking the user
     anything. Copy it even though it starts empty. A ledger created on the day it is first
     needed is a ledger each turn invents a format for.
   - **On an existing bank this is a migration, not a template swap.** Every step file that
     destructures a page-object fixture must be converted in the same change. A step asking for
     a fixture that no longer exists aborts collection for the *entire* bank — every scenario
     errors, not just that one — so a half-done conversion looks like total failure.
   - In the config's `webServer` block, replace `command` and `url` with this repo's real dev
     command and port. Without that, CI has nothing to test against. If the bank should run
     against an already-deployed app instead, leave it and set `BANK_BASE_URL`.
4a. **Scaffold the fixture reset, and make it assert.** Copy
   `${CLAUDE_PLUGIN_ROOT}/templates/steps/reset.ts` to `steps/reset.ts`. This is the most
   load-bearing part of a bank's isolation and it is the one place adopters reliably write a
   fire-and-forget POST. On the first real adoption that hook swallowed a 500 — a table had been
   added to the schema and the reset's delete list had not — and five scenarios passed against a
   half-deleted database. Nothing failed; a human reading the seed file found it.

   Three things to do rather than copy blindly, in this order:

   - **Find the project's reset endpoint** and set `BANK_RESET_PATH` (or edit the default) to
     match. If there is none, ask the user whether to add one or to delete `steps/reset.ts` and
     record how scenarios get clean state instead. Do not leave the file in place pointing at
     nothing.
   - **Fill in `RESET_IMPL` and `SCHEMA_SOURCE` with this project's real paths.** They are what
     the failure message names, and that is the difference between "reset failed: 500" and a
     two-minute fix. A placeholder left in place downgrades every future diagnostic to a status
     code; treat it as an unfinished step, not a nicety.
   - **Make the endpoint enumerate the schema.** The hook's default mode requires the response
     to report the tables that *exist* alongside the ones it *cleared*, and fails when they
     disagree. That check is what catches the original defect at the migration rather than three
     weeks later, and it is why the endpoint must read `information_schema.tables`, the ORM's
     model registry, `sqlite_master` — anything live — rather than echoing a constant. A
     hard-coded delete list is a second list every migration must remember, and a list
     maintained by memory is the defect rather than the symptom.

   If the project genuinely cannot enumerate, `BANK_RESET_EXPECT=body` drops to asserting only
   what was reset. Say plainly that this is a downgrade and why, rather than setting it quietly.
   **Never weaken the assertion to get a green first run** — a green run against a half-reset
   database is the exact outcome the whole file exists to prevent.

   One conflict to settle here rather than discover later: a shared reset endpoint and
   `fullyParallel: true` are incompatible, because one worker wipes the database while another
   is mid-scenario. Either set `workers: 1` for the bank project, give each worker its own
   database, or drop the hook in favour of per-scenario unique data. Tell the user which you
   chose.

5. **Add scripts** to `package.json`, exactly these — the tag filter is not optional:
   ```json
   "bdd:gen":    "bddgen --tags \"not @draft\"",
   "test:bank":  "npm run bdd:gen && playwright test --project=bank --pass-with-no-tests",
   "test:smoke": "bddgen --tags \"@smoke and not @draft and not @known-defect and not @quarantine and not @needs-decision\" && playwright test --project=bank --pass-with-no-tests"
   ```
   `--pass-with-no-tests` matters more than it looks. Straight after `/tddbanking:discover`
   the bank is entirely drafts, so generation emits nothing and Playwright exits 1 with
   "No tests found" — CI goes red for the crime of not having implemented anything yet, on
   day one, which is exactly when people decide whether to trust the setup. An empty live
   suite is a legitimate state; coverage is reported by `/tddbanking:status`, not by CI going
   red. Drop `--project=bank` **only** when the config has no other projects — otherwise
   `test:bank` drags the repo's existing suite along and the bank's runtime stops meaning
   anything. Translate `npm run` to the detected package manager. Explain to the user, in one
   line, that calling `bddgen` bare will fail on drafts by design.
6. **Gitignore** `.features-gen/`, `test-results/`, `playwright-report/`.
6a. **Keep the bank inside the type checker and outside the other test runner.** Two gaps that
   look small and are not:
   - Add `pages/` and `steps/` to the project's `tsconfig.json` includes. A bank whose page
     objects are untypechecked will accumulate real errors invisibly — a duplicate property
     declaration survived undetected in one production bank because `tsconfig` covered only
     `src`.
   - Exclude `.features-gen/**` from any other test runner the project uses (vitest, jest). The
     generated specs are Playwright tests; another runner will collect them and report a screenful
     of failures that belong to nobody. This breaks the promise that the bank leaves the existing
     suite alone.
7. **Add CI** from `${CLAUDE_PLUGIN_ROOT}/templates/workflows/bank.yml` to
   `.github/workflows/bank.yml` — skip if a workflow already runs Playwright, and instead
   tell the user which job to add `test:smoke` to.
   **Pushing this file needs `workflow` scope.** A GitHub OAuth token without it has the push
   rejected outright — `refusing to allow an OAuth App to create or update workflow` — and it
   rejects the whole branch, not just this file. If that happens, commit it as
   `ci/bank.yml.example` and tell the user plainly that the gate is off until they move it
   into `.github/workflows/`. Do not quietly drop it: the workflow is the mechanism that stops
   the bank rotting, and a bank that only runs locally is the failure this loop prevents. Adapt `npm ci` and the run commands to the
   detected package manager. A bank that does not run on every PR rots; this step is what
   makes the difference, so do not quietly omit it.
8. **Check the three reports work**, because every later turn reports through them rather than
   improvising:
   - `node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs` should report the example scenario.
   - `node ${CLAUDE_PLUGIN_ROOT}/scripts/decisions.mjs` should find the ledger and report zero
     decisions.
   - `node ${CLAUDE_PLUGIN_ROOT}/scripts/ci-wiring.mjs` says which test entry points CI actually
     runs. **Read this one out to the user now**, and name every script and Playwright project
     nothing invokes. Installing a gated bank into a repository says nothing about the suite
     beside it: on the first adoption, a whole unit suite was run by no workflow for months, and
     when someone finally ran it, its failures read as accumulated history — three days old, and
     caused from inside this loop. A suite nothing runs does not merely go unread; it silently
     reassigns blame to whoever finds it next. The moment after installing a new gate is the
     cheapest moment to notice.
9. **Prove it runs.** Run `test:bank` and confirm the example scenario passes. A scaffold that
   has never gone green is not a scaffold.

   If it goes red inside `steps/reset.ts`, read the message: it names what is wrong and where.
   The fix is always the endpoint — implement it, extend its delete list, make it enumerate the
   schema. **The fix is never to loosen the assertion**, and an early red here is the hook doing
   its job on day one rather than in six months.

Report: what was installed, the scripts added, whether the fixture reset asserts and in which
mode, what CI runs and what it does not, and that the next step is turn 1,
`/tddbanking:discover`. Mention that the loop is five turns and ends at `/tddbanking:develop` —
it does not run continuously.
