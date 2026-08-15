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
     `features/example.feature`
   - `steps/fixtures.ts` intentionally registers no page-object fixtures. Steps construct
     their own Page Objects from `page`, so that turn 2 can implement many capabilities in
     parallel without every worker editing one shared file.
   - In the config's `webServer` block, replace `command` and `url` with this repo's real dev
     command and port. Without that, CI has nothing to test against. If the bank should run
     against an already-deployed app instead, leave it and set `BANK_BASE_URL`.
5. **Add scripts** to `package.json`, exactly these — the tag filter is not optional:
   ```json
   "bdd:gen":    "bddgen --tags \"not @draft\"",
   "test:bank":  "npm run bdd:gen && playwright test --project=bank --pass-with-no-tests",
   "test:smoke": "bddgen --tags \"@smoke and not @draft and not @known-defect and not @quarantine\" && playwright test --project=bank --pass-with-no-tests"
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
8. **Check coverage reporting works**:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/bank-stats.mjs` should report the example scenario.
   Every later turn reports through that script rather than parsing feature files by hand.
9. **Prove it runs.** Run `test:bank` and confirm the example scenario passes. A scaffold that
   has never gone green is not a scaffold.

Report: what was installed, the scripts added, and that the next step is turn 1,
`/tddbanking:discover`. Mention that the loop is four turns and ends at `/tddbanking:file` —
it does not run continuously.
